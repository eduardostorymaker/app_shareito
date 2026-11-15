import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, ReceiptText, TrendingDown, TrendingUp } from "lucide-react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/skeletons";
import { ExpenseList } from "@/components/expenses/expense-list";
import { NewExpenseButton } from "@/components/expenses/new-expense-button";
import { OpenComposerOnLoad } from "@/components/expenses/open-composer-on-load";
import { getProfile } from "@/lib/auth";
import { getGroupBalance, getMyGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { describeSituation } from "@/lib/balance";
import { toISODate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inicio" };

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton cards={2} rows={5} />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const profile = await getProfile();
  const supabase = await createClient();
  const today = new Date(`${todayISO(profile.timezone)}T12:00:00`);
  const monthStart = toISODate(startOfMonth(today));
  const monthEnd = toISODate(endOfMonth(today));
  const prevStart = toISODate(startOfMonth(subMonths(today, 1)));

  const [groups, months, recent] = await Promise.all([
    getMyGroups(),
    supabase.rpc("dashboard_by_month", { p_from: prevStart, p_to: monthEnd }),
    supabase
      .from("v_expenses")
      .select("*")
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const balances = await Promise.all(groups.map((g) => getGroupBalance(g.id)));
  const monthRows = (months.data ?? []).filter((m) => m.currency === profile.currency);
  const thisMonth = monthRows.find((m) => m.month === monthStart);
  const lastMonth = monthRows.find((m) => m.month === prevStart);
  const total = Number(thisMonth?.total ?? 0);
  const prevTotal = Number(lastMonth?.total ?? 0);
  const diff = prevTotal > 0 ? (total - prevTotal) / prevTotal : null;
  const firstName = (profile.display_name || "").split(" ")[0];
  const expenses = recent.data ?? [];

  return (
    <div className="space-y-8">
      <OpenComposerOnLoad />
      <section className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Hola{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-2xl font-semibold tracking-tight capitalize">{format(today, "MMMM yyyy", { locale: es })}</h1>
        </div>

        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Llevas gastado este mes</p>
            <Money amount={total} currency={profile.currency} locale={profile.locale} tabular={false} className="block text-4xl font-semibold tracking-tight" />
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>
                {thisMonth?.tx_count ?? 0} {thisMonth?.tx_count === 1 ? "gasto" : "gastos"} · tu parte incluida
              </span>
              {diff !== null ? (
                <span className={cn("inline-flex items-center gap-1", diff > 0 ? "text-negative" : "text-positive")}>
                  {diff > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {Math.abs(Math.round(diff * 100))}% vs. el mes pasado completo
                </span>
              ) : null}
            </p>
          </CardContent>
        </Card>
      </section>

      {groups.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Tus grupos</h2>
            <Link href="/grupos" className="text-sm font-medium text-primary">
              Ver grupos
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g, i) => {
              const b = balances[i];
              const s = b ? describeSituation(b, profile.id, profile.locale) : null;
              return (
                <Link
                  key={g.id}
                  href={`/grupos/${g.id}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p
                      className={cn(
                        "truncate text-sm",
                        s?.tone === "positive" && "text-positive",
                        s?.tone === "negative" && "text-negative",
                        (!s || s.tone === "neutral") && "text-muted-foreground",
                      )}
                    >
                      {s?.text ?? "Sin datos"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Últimos gastos</h2>
          {expenses.length ? (
            <Link href="/gastos" className="text-sm font-medium text-primary">
              Ver todos
            </Link>
          ) : null}
        </div>
        {expenses.length ? (
          <ExpenseList expenses={expenses} userId={profile.id} locale={profile.locale} showTotals={false} className="-mx-2" />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Registra tu primer gasto"
            description="Importe, categoría y listo. Tus gastos aparecerán aquí."
            action={<NewExpenseButton label="Añadir gasto" />}
          />
        )}
      </section>
    </div>
  );
}
