import { ArrowRight } from "lucide-react";
import { Money } from "@/components/shared/money";
import { UserAvatar } from "@/components/shared/user-avatar";

type BalanceRow = { user_id: string; display_name: string; avatar_url: string | null; paid: number; share: number; balance: number };

export function BalanceTable({
  rows,
  currency,
  locale,
  meId,
}: {
  rows: BalanceRow[];
  currency: string;
  locale: string;
  meId: string;
}) {
  return (
    <div className="divide-y rounded-xl border">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_7rem_7rem_7rem]">
        <span>Persona</span>
        <span className="hidden text-right sm:block">Pagó</span>
        <span className="text-right">Le toca</span>
        <span className="text-right">Diferencia</span>
      </div>
      {rows.map((r) => (
        <div key={r.user_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_7rem_7rem_7rem]">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={r.display_name} src={r.avatar_url} className="size-7" />
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {r.display_name}
                {r.user_id === meId ? <span className="font-normal text-muted-foreground"> (tú)</span> : null}
              </span>
              <span className="block text-xs text-muted-foreground sm:hidden">
                pagó <Money amount={r.paid} currency={currency} locale={locale} />
              </span>
            </span>
          </span>
          <Money amount={r.paid} currency={currency} locale={locale} className="hidden text-right sm:block" />
          <Money amount={r.share} currency={currency} locale={locale} tone="muted" className="text-right" />
          <Money amount={r.balance} currency={currency} locale={locale} tone="auto" signed className="text-right font-semibold" />
        </div>
      ))}
    </div>
  );
}

export function TransferRow({
  from,
  to,
  amount,
  currency,
  locale,
  action,
  paid,
}: {
  from: string;
  to: string;
  amount: number;
  currency: string;
  locale: string;
  action?: React.ReactNode;
  paid?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="truncate font-medium">{from}</span>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-label="le paga a" />
        <span className="truncate font-medium">{to}</span>
      </div>
      <Money amount={amount} currency={currency} locale={locale} className={paid ? "text-muted-foreground line-through" : "font-semibold"} />
      {action}
    </div>
  );
}
