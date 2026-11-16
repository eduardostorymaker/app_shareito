import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CheckCircle2, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { Money } from "@/components/shared/money";
import { ExpenseList } from "@/components/expenses/expense-list";
import { BalanceTable, TransferRow } from "@/components/groups/balance-table";
import { ReopenPeriodButton, TransferPaidButton } from "@/components/groups/period-actions";
import { getProfile } from "@/lib/auth";
import { getGroup, getProfileNames } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPeriod } from "@/lib/format";
import { describeClosing } from "@/lib/periods";

export const metadata = { title: "Cierre de periodo" };

export default function SettlementPage({ params }: PageProps<"/grupos/[id]/cierres/[sid]">) {
  return (
    <Suspense fallback={<PageSkeleton cards={2} rows={4} />}>
      <SettlementDetail params={params} />
    </Suspense>
  );
}

async function SettlementDetail({ params }: { params: PageProps<"/grupos/[id]/cierres/[sid]">["params"] }) {
  const [{ id, sid }, profile] = await Promise.all([params, getProfile()]);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(sid)) notFound();
  const group = await getGroup(id);
  if (!group) notFound();
  const supabase = await createClient();

  const [{ data: s }, { data: balances }, { data: transfers }, { data: expenses }, { data: latest }] = await Promise.all([
    supabase.from("settlements").select("*").eq("id", sid).eq("group_id", id).maybeSingle(),
    supabase.from("settlement_balances").select("*").eq("settlement_id", sid),
    supabase.from("settlement_transfers").select("*").eq("settlement_id", sid).order("amount", { ascending: false }),
    supabase
      .from("v_expenses")
      .select("*")
      .eq("settlement_id", sid)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("settlements")
      .select("id")
      .eq("group_id", id)
      .eq("status", "closed")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!s) notFound();

  const people = [
    ...(balances ?? []).map((b) => b.user_id),
    ...(transfers ?? []).flatMap((t) => [t.from_user, t.to_user]),
    s.closed_by ?? "",
    s.reopened_by ?? "",
  ];
  const names = await getProfileNames(people);
  const nameOf = (uid: string | null) => (!uid ? "Cierre automático" : uid === profile.id ? "Tú" : (names.get(uid) ?? "Alguien"));
  const avatars = new Map(group.members.map((m) => [m.user_id, m.avatar_url]));

  const isOwner = group.members.some((m) => m.user_id === profile.id && m.role === "owner");
  const isLatest = latest?.id === s.id && s.status === "closed";
  const allPaid = (transfers ?? []).length > 0 && (transfers ?? []).every((t) => t.paid_at);
  const period = formatPeriod(s.period_start, s.period_end);

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/grupos/${id}`, label: group.name }}
        title={`Cierre ${period}`}
        description={
          <>
            {s.closed_by ? `Cerrado por ${nameOf(s.closed_by)}` : "Cierre automático"} · {formatDateTime(s.closed_at)} ·{" "}
            {describeClosing(s.closing_type, s.closing_day)}
          </>
        }
        actions={isOwner && isLatest && !group.archived_at ? <ReopenPeriodButton groupId={id} period={period} /> : null}
      />

      {s.status === "reopened" ? (
        <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <LockOpen className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            {nameOf(s.reopened_by)} reabrió este periodo el {formatDateTime(s.reopened_at!)}. Esta foto se conserva como historial; el cierre vigente es el
            posterior.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Total del periodo</p>
            <Money amount={s.total_amount} currency={s.currency} locale={profile.locale} tabular={false} className="block font-heading text-2xl font-semibold" />
            <p className="text-sm text-muted-foreground">entre {s.member_count} personas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Estado de los pagos</p>
            {(transfers ?? []).length === 0 ? (
              <p className="text-lg font-medium">Nadie le debía a nadie</p>
            ) : allPaid ? (
              <p className="flex items-center gap-2 text-lg font-medium text-positive">
                <CheckCircle2 className="size-5" /> Todo pagado
              </p>
            ) : (
              <p className="text-lg font-medium">
                {(transfers ?? []).filter((t) => t.paid_at).length} de {(transfers ?? []).length} pagos hechos
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(transfers ?? []).length ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Quién le paga a quién</h2>
          <div className="divide-y rounded-xl border">
            {(transfers ?? []).map((t) => (
              <TransferRow
                key={t.id}
                from={nameOf(t.from_user)}
                to={nameOf(t.to_user)}
                amount={t.amount}
                currency={s.currency}
                locale={profile.locale}
                paid={Boolean(t.paid_at)}
                action={
                  <span className="flex items-center gap-2">
                    {t.paid_at ? <Badge variant="secondary">Pagada</Badge> : null}
                    <TransferPaidButton
                      transferId={t.id}
                      paid={Boolean(t.paid_at)}
                      canMark={s.status === "closed" && (isOwner || t.from_user === profile.id || t.to_user === profile.id)}
                    />
                  </span>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold">Balance</h2>
        <BalanceTable
          rows={(balances ?? [])
            .map((b) => ({ ...b, display_name: names.get(b.user_id) ?? "Alguien", avatar_url: avatars.get(b.user_id) ?? null }))
            .sort((a, b) => b.balance - a.balance)}
          currency={s.currency}
          locale={profile.locale}
          meId={profile.id}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Gastos incluidos ({expenses?.length ?? 0})</h2>
        {expenses?.length ? (
          <ExpenseList expenses={expenses} userId={profile.id} locale={profile.locale} className="-mx-2" />
        ) : (
          <p className="text-sm text-muted-foreground">
            {s.status === "reopened" ? "Los gastos de este periodo pasaron al cierre vigente." : "No hubo gastos en este periodo."}
          </p>
        )}
      </section>
    </div>
  );
}
