import { Suspense } from "react";
import Link from "next/link";
import { ChartPie, ChevronLeft } from "lucide-react";
import { endOfMonth, format, min as minDate, parseISO, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { CategoryIcon } from "@/components/shared/category-icon";
import { NewExpenseButton } from "@/components/expenses/new-expense-button";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { RankedBars } from "@/components/dashboard/ranked-bars";
import { getProfile } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatMoney, formatPeriod, formatShortDate, toISODate, todayISO } from "@/lib/format";
import { previousRange, resolveRange } from "@/lib/ranges";
import { cn } from "@/lib/utils";

export const metadata = { title: "Panel" };

export default function DashboardPage({ searchParams }: PageProps<"/panel">) {
  return (
    <Suspense fallback={<PageSkeleton cards={4} rows={6} />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const isId = (v?: string) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));

async function Dashboard({ searchParams }: { searchParams: PageProps<"/panel">["searchParams"] }) {
  const [profile, sp, groups] = await Promise.all([getProfile(), searchParams, getMyGroups({ includeArchived: true })]);
  const supabase = await createClient();

  const todayIso = todayISO(profile.timezone);
  const today = new Date(`${todayIso}T12:00:00`);
  const range = resolveRange(str(sp.rango) ?? "mes", today, { from: str(sp.desde), to: str(sp.hasta) }) ?? resolveRange("mes", today)!;
  const scope = str(sp.tipo) === "personal" ? "personal" : str(sp.tipo) === "compartido" ? "shared" : "all";
  const groupId = isId(str(sp.grupo)) ? str(sp.grupo)! : null;
  const full = str(sp.vista) === "total";
  const drill = isId(str(sp.cat)) ? str(sp.cat)! : null;
  const prev = previousRange(range.from, range.to);

  // Evolución: al menos 6 meses terminando en el fin del rango (o en el mes actual).
  const evoEnd = minDate([parseISO(range.to), endOfMonth(today)]);
  const evoFrom = minDate([startOfMonth(parseISO(range.from)), startOfMonth(subMonths(evoEnd, 5))]);
  const common = { p_scope: scope, p_group_id: groupId ?? undefined, p_full_amount: full };

  let rowsQuery = supabase
    .from("v_expenses")
    .select("id, scope, amount, share_amount, currency, payment_method, description, merchant, category_name, category_icon, category_color, expense_date, group_name")
    .is("deleted_at", null)
    .gte("expense_date", range.from)
    .lte("expense_date", range.to)
    .limit(5000);
  if (scope !== "all") rowsQuery = rowsQuery.eq("scope", scope);
  if (groupId) rowsQuery = rowsQuery.eq("group_id", groupId);

  const [byParent, byChild, byPrev, months, rowsRes, cats] = await Promise.all([
    supabase.rpc("dashboard_by_category", { p_from: range.from, p_to: range.to, ...common, p_level: "parent" }),
    drill ? supabase.rpc("dashboard_by_category", { p_from: range.from, p_to: range.to, ...common, p_level: "child" }) : Promise.resolve({ data: [] }),
    supabase.rpc("dashboard_by_category", { p_from: prev.from, p_to: prev.to, ...common, p_level: "parent" }),
    supabase.rpc("dashboard_by_month", { p_from: toISODate(evoFrom), p_to: toISODate(evoEnd), ...common }),
    rowsQuery,
    drill ? supabase.from("categories").select("id, parent_id, name").or(`id.eq.${drill},parent_id.eq.${drill}`) : Promise.resolve({ data: [] }),
  ]);

  const parentRows = byParent.data ?? [];
  const currencies = [...new Set([...parentRows.map((r) => r.currency), ...(months.data ?? []).map((m) => m.currency)])].sort(
    (a, b) => (a === profile.currency ? -1 : b === profile.currency ? 1 : a.localeCompare(b)),
  );
  const requested = str(sp.moneda);
  const currency = requested && currencies.includes(requested) ? requested : (currencies[0] ?? profile.currency);
  const locale = profile.locale;

  const inCur = parentRows.filter((r) => r.currency === currency);
  const total = inCur.reduce((s, r) => s + Number(r.total), 0);
  const count = inCur.reduce((s, r) => s + Number(r.tx_count), 0);
  const prevTotal = (byPrev.data ?? []).filter((r) => r.currency === currency).reduce((s, r) => s + Number(r.total), 0);
  const delta = prevTotal > 0 ? (total - prevTotal) / prevTotal : null;
  const elapsedEnd = range.to < todayIso ? range.to : todayIso;
  const days = Math.max(1, Math.round((parseISO(elapsedEnd).getTime() - parseISO(range.from).getTime()) / 86_400_000) + 1);

  const rows = (rowsRes.data ?? []).filter((r) => r.currency === currency);
  const valueOf = (r: { amount: number; share_amount: number | null }) => (full ? r.amount : (r.share_amount ?? r.amount));

  // Drill-down: subcategorías de la categoría elegida.
  const drillCats = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const drillParent = drill ? (drillCats.get(drill) ?? null) : null;
  const childRows = drill
    ? (byChild.data ?? []).filter((r) => r.currency === currency && r.category_id && drillCats.has(r.category_id))
    : [];

  const linkWith = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/panel${p.size ? `?${p}` : ""}`;
  };

  const categoryItems = (drill ? childRows : inCur).map((r) => ({
    key: r.category_id ?? r.name ?? "x",
    label: r.name ?? "Sin categoría",
    value: Number(r.total),
    count: Number(r.tx_count),
    icon: r.icon,
    color: r.color,
    href: drill || !r.category_id ? undefined : linkWith({ cat: r.category_id }),
  }));

  const monthData = (months.data ?? [])
    .filter((m) => m.currency === currency)
    .map((m) => ({
      month: m.month,
      label: format(parseISO(m.month), evoMonthsSpanYears(months.data ?? []) ? "MMM yy" : "MMM", { locale: es }),
      total: Number(m.total),
      count: Number(m.tx_count),
    }));
  fillMissingMonths(monthData, evoFrom, evoEnd);

  const top = [...rows].sort((a, b) => valueOf(b) - valueOf(a)).slice(0, 10);
  const byMethod = new Map<string, { value: number; count: number }>();
  for (const r of rows) {
    const m = byMethod.get(r.payment_method) ?? { value: 0, count: 0 };
    m.value += valueOf(r);
    m.count += 1;
    byMethod.set(r.payment_method, m);
  }
  const methodItems = [...byMethod.entries()]
    .map(([k, v]) => ({ key: k, label: PAYMENT_METHOD_LABEL[k] ?? k, value: Math.round(v.value * 100) / 100, count: v.count }))
    .sort((a, b) => b.value - a.value);

  const personal = rows.filter((r) => r.scope === "personal").reduce((s, r) => s + valueOf(r), 0);
  const shared = rows.filter((r) => r.scope === "shared").reduce((s, r) => s + valueOf(r), 0);
  const topCategory = inCur[0];

  return (
    <div>
      <PageHeader title="Panel" description={`${formatPeriod(range.from, range.to)} · ${full ? "importe total de los compartidos" : "tu parte de los compartidos"}`} />

      <DashboardFilters groups={groups.map((g) => ({ id: g.id, name: g.name }))} currencies={currencies}>
        {count === 0 ? (
          <EmptyState
            icon={ChartPie}
            title={`No hay gastos en ${range.label}`}
            description="Cambia el periodo o los filtros, o registra un gasto para ver el análisis."
            action={<NewExpenseButton label="Registrar un gasto" />}
          />
        ) : (
          <div className="space-y-6">
            <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Total gastado">
                <Money amount={total} currency={currency} locale={locale} tabular={false} />
              </StatTile>
              <StatTile label="Promedio diario" hint={`${days} ${days === 1 ? "día" : "días"}`}>
                <Money amount={total / days} currency={currency} locale={locale} tabular={false} />
              </StatTile>
              <StatTile label="Gastos" hint={topCategory ? `Más en ${topCategory.name}` : undefined}>
                {count}
              </StatTile>
              <StatTile label="Frente al periodo anterior" hint={prevTotal > 0 ? `antes ${formatMoney(prevTotal, currency, locale)}` : "sin datos previos"}>
                {delta === null ? (
                  "—"
                ) : (
                  <span className={delta > 0 ? "text-negative" : "text-positive"}>
                    {delta > 0 ? "+" : "−"}
                    {Math.abs(Math.round(delta * 100))}%
                  </span>
                )}
              </StatTile>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>{drillParent ? drillParent.name : "Por categoría"}</CardTitle>
                <CardDescription>
                  {drillParent ? (
                    <Link href={linkWith({ cat: null })} scroll={false} className="inline-flex items-center gap-0.5 font-medium text-primary">
                      <ChevronLeft className="size-4" /> Todas las categorías
                    </Link>
                  ) : (
                    "Toca una categoría para ver sus subcategorías."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryItems.length ? (
                  <RankedBars items={categoryItems} currency={currency} locale={locale} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin gastos en esta categoría para el periodo.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evolución mensual</CardTitle>
                <CardDescription>
                  {formatPeriod(toISODate(evoFrom), toISODate(evoEnd))} · {currency}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyChart data={monthData} currency={currency} locale={locale} />
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Ver como tabla</summary>
                  <table className="mt-2 w-full text-left">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Mes</th>
                        <th className="py-1 text-right font-medium">Gastos</th>
                        <th className="py-1 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {monthData.map((m) => (
                        <tr key={m.month}>
                          <td className="py-1.5 capitalize">{format(parseISO(m.month), "MMMM yyyy", { locale: es })}</td>
                          <td className="py-1.5 text-right tabular-nums">{m.count}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatMoney(m.total, currency, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Mayores gastos</CardTitle>
                  <CardDescription>Los 10 más altos del periodo</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1">
                    {top.map((e, i) => (
                      <li key={e.id}>
                        <Link href={`/gastos/${e.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                          <span className="w-4 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                          <CategoryIcon icon={e.category_icon} color={e.category_color} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.description || e.merchant || e.category_name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {formatShortDate(e.expense_date)} · {e.scope === "shared" ? e.group_name : "Personal"}
                            </span>
                          </span>
                          <Money amount={valueOf(e)} currency={currency} locale={locale} className="text-sm font-semibold" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <div className="space-y-6">
                {scope === "all" && personal > 0 && shared > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Personal y compartido</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-[4px]" aria-hidden>
                        <div className="bg-series-1" style={{ width: `${(personal / (personal + shared)) * 100}%` }} />
                        <div className="bg-series-2" style={{ width: `${(shared / (personal + shared)) * 100}%` }} />
                      </div>
                      <ul className="space-y-2 text-sm">
                        {(
                          [
                            ["Personal", personal, "bg-series-1"],
                            [full ? "Compartido (total)" : "Compartido (tu parte)", shared, "bg-series-2"],
                          ] as const
                        ).map(([label, v, swatch]) => (
                          <li key={label} className="flex items-center gap-2">
                            <span className={cn("size-2.5 rounded-sm", swatch)} aria-hidden />
                            <span className="flex-1">{label}</span>
                            <span className="tabular-nums">{formatMoney(v, currency, locale)}</span>
                            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((v / (personal + shared)) * 100)}%</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle>Por método de pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankedBars items={methodItems} currency={currency} locale={locale} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </DashboardFilters>
    </div>
  );
}

function StatTile({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl">{children}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function evoMonthsSpanYears(rows: { month: string }[]) {
  return new Set(rows.map((r) => r.month.slice(0, 4))).size > 1;
}

/** Los meses sin gastos aparecen como 0 para no falsear la línea temporal. */
function fillMissingMonths(data: { month: string; label: string; total: number; count: number }[], from: Date, to: Date) {
  const have = new Set(data.map((d) => d.month));
  const spansYears = from.getFullYear() !== to.getFullYear();
  for (let d = startOfMonth(from); d <= to; d = startOfMonth(subMonths(d, -1))) {
    const key = toISODate(d);
    if (!have.has(key)) data.push({ month: key, label: format(d, spansYears ? "MMM yy" : "MMM", { locale: es }), total: 0, count: 0 });
  }
  data.sort((a, b) => a.month.localeCompare(b.month));
  if (spansYears) for (const d of data) d.label = format(parseISO(d.month), "MMM yy", { locale: es });
}
