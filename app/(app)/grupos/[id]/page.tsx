import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ChevronRight, LockOpen, ReceiptText, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { ExpenseList } from "@/components/expenses/expense-list";
import { NewExpenseButton } from "@/components/expenses/new-expense-button";
import { BalanceTable, TransferRow } from "@/components/groups/balance-table";
import { GroupRealtime } from "@/components/groups/group-realtime";
import { RecloseButton } from "@/components/groups/period-actions";
import { getProfile } from "@/lib/auth";
import { getGroup, getGroupBalance, getProfileNames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { describeSituation } from "@/lib/balance";
import { collectAuditRefs, describeGroupEntry } from "@/lib/audit";
import { daysUntil, describeClosing, describeRemaining } from "@/lib/periods";
import { formatDateTime, formatPeriod, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Grupo" };

export default function GroupPage({ params }: PageProps<"/grupos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton cards={2} rows={6} />}>
      <GroupDetail params={params} />
    </Suspense>
  );
}

async function GroupDetail({ params }: { params: PageProps<"/grupos/[id]">["params"] }) {
  const [{ id }, profile] = await Promise.all([params, getProfile()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const group = await getGroup(id);
  if (!group) notFound();

  const supabase = await createClient();
  const balance = await getGroupBalance(id); // cierra antes los periodos vencidos
  if (!balance) notFound();

  const [{ data: expenses }, { data: settlements }, { data: activity }] = await Promise.all([
    supabase
      .from("v_expenses")
      .select("*")
      .eq("group_id", id)
      .is("settlement_id", null)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("settlements")
      .select("*, settlement_transfers(id, paid_at)")
      .eq("group_id", id)
      .order("period_end", { ascending: false })
      .order("closed_at", { ascending: false })
      .limit(24),
    supabase.from("audit_log").select("*").eq("group_id", id).order("created_at", { ascending: false }).limit(40),
  ]);

  const isOwner = group.members.some((m) => m.user_id === profile.id && m.role === "owner");
  const situation = describeSituation(balance, profile.id, profile.locale);
  const today = todayISO(group.timezone);
  const remaining = daysUntil(balance.period_end, today);
  const nameOf = (uid: string) => (uid === profile.id ? "Tú" : (balance.balances.find((b) => b.user_id === uid)?.display_name ?? "Alguien"));

  const refs = collectAuditRefs(activity ?? []);
  const [names, cats] = await Promise.all([
    getProfileNames(refs.people),
    refs.categories.length ? supabase.from("categories").select("id, name").in("id", refs.categories) : Promise.resolve({ data: [] }),
  ]);
  const ctx = {
    names,
    categories: new Map((cats.data ?? []).map((c) => [c.id, c.name])),
    groups: new Map([[group.id, group.name]]),
    locale: profile.locale,
    meId: profile.id,
  };
  const activityLines = (activity ?? [])
    .map((a) => ({ id: a.id, at: a.created_at, text: describeGroupEntry(a, ctx) }))
    .filter((a): a is { id: number; at: string; text: string } => Boolean(a.text))
    .slice(0, 15);

  return (
    <div className="space-y-8">
      <GroupRealtime groupId={id} />
      <PageHeader
        back={{ href: "/grupos", label: "Grupos" }}
        title={
          <span className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden />
            {group.name}
          </span>
        }
        description={`${group.members.map((m) => m.display_name).join(", ")} · ${describeClosing(group.closing_type, group.closing_day)}`}
        actions={
          <Button asChild variant="ghost" size="icon" aria-label="Configurar grupo">
            <Link href={`/ajustes/grupos/${id}`}>
              <Settings />
            </Link>
          </Button>
        }
      />

      {group.archived_at ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-3 text-sm">
          <Archive className="size-4 shrink-0 text-muted-foreground" /> Grupo archivado: no admite gastos nuevos.
        </div>
      ) : null}

      {balance.close_hold ? (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm sm:flex-row sm:items-center">
          <LockOpen className="size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium">Periodo reabierto para correcciones</p>
            <p className="text-muted-foreground">
              El cierre automático está en pausa. {isOwner ? "Cuando termines, vuelve a cerrarlo." : "Un propietario debe volver a cerrarlo."}
            </p>
          </div>
          {isOwner ? <RecloseButton groupId={id} /> : null}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Card className="sm:col-span-2">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Tu situación</p>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight",
                  situation.tone === "positive" && "text-positive",
                  situation.tone === "negative" && "text-negative",
                )}
              >
                {situation.text}
              </p>
            </div>
            {!group.archived_at ? <NewExpenseButton groupId={id} label="Gasto compartido" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Periodo abierto</p>
            <p className="font-medium">{formatPeriod(balance.period_start, balance.period_end)}</p>
            <p className="text-sm text-muted-foreground">{balance.close_hold ? "En pausa" : describeRemaining(remaining)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Gastado en el periodo</p>
            <Money amount={balance.total} currency={balance.currency} locale={profile.locale} tabular={false} className="block text-2xl font-semibold" />
            <p className="text-sm text-muted-foreground">
              entre {balance.balances.length} · <Money amount={balance.balances.length ? balance.total / balance.balances.length : 0} currency={balance.currency} locale={profile.locale} /> por persona
            </p>
          </CardContent>
        </Card>
      </section>

      {group.members.length === 1 && !group.archived_at ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-muted-foreground">
            Eres el único miembro. Invita a las personas con las que compartes gastos para que la app reparta el total entre todos.
          </p>
          {isOwner ? (
            <Button asChild variant="outline">
              <Link href={`/ajustes/grupos/${id}?invitar=1`}>Invitar</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {balance.total > 0 && group.members.length > 1 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Balance del periodo</h2>
          <BalanceTable rows={balance.balances} currency={balance.currency} locale={profile.locale} meId={profile.id} />
          {balance.transfers.length ? (
            <div className="rounded-xl border">
              <p className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">Para quedar a mano al cierre</p>
              <div className="divide-y">
                {balance.transfers.map((t, i) => (
                  <TransferRow key={i} from={nameOf(t.from_user)} to={nameOf(t.to_user)} amount={t.amount} currency={balance.currency} locale={profile.locale} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold">Gastos del periodo</h2>
        {expenses?.length ? (
          <ExpenseList expenses={expenses} userId={profile.id} locale={profile.locale} className="-mx-2" />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Sin gastos en este periodo"
            description="Cada miembro registra lo que paga. Al cierre, la app calcula quién le debe a quién."
            action={!group.archived_at ? <NewExpenseButton groupId={id} label="Añadir gasto compartido" /> : undefined}
          />
        )}
      </section>

      {settlements?.length ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Cierres anteriores</h2>
          <div className="divide-y rounded-xl border">
            {settlements.map((s) => {
              const transfers = s.settlement_transfers ?? [];
              const paid = transfers.filter((t) => t.paid_at).length;
              return (
                <Link key={s.id} href={`/grupos/${id}/cierres/${s.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatPeriod(s.period_start, s.period_end)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.status === "reopened"
                        ? "Reabierto"
                        : transfers.length === 0
                          ? "Sin deudas"
                          : paid === transfers.length
                            ? "Todo pagado"
                            : `${paid} de ${transfers.length} pagos hechos`}
                    </p>
                  </div>
                  {s.status === "reopened" ? <Badge variant="outline">Reabierto</Badge> : null}
                  <Money amount={s.total_amount} currency={s.currency} locale={profile.locale} className="font-medium" />
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {activityLines.length ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Actividad</h2>
          <ol className="space-y-2.5">
            {activityLines.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                <span className="min-w-0 flex-1">
                  {a.text}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(a.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
