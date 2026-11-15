import Link from "next/link";
import { Lock, Paperclip } from "lucide-react";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { formatDayHeading, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExpenseView } from "@/lib/types";

type Row = Pick<
  ExpenseView,
  | "id" | "scope" | "group_name" | "paid_by" | "paid_by_name" | "category_name" | "category_icon" | "category_color"
  | "root_category_name" | "amount" | "currency" | "share_amount" | "split_count" | "description" | "merchant"
  | "expense_date" | "is_locked"
> & { has_attachment?: boolean };

export function ExpenseRow({ e, userId, locale, href }: { e: Row; userId: string; locale: string; href?: string }) {
  const title = e.description || e.merchant || e.category_name || "Gasto";
  const meta = [
    e.description || e.merchant ? e.category_name : e.root_category_name !== e.category_name ? e.root_category_name : null,
    e.scope === "shared" ? e.group_name : "Personal",
    e.scope === "shared" && e.paid_by !== userId ? `pagó ${e.paid_by_name}` : null,
  ].filter(Boolean);

  return (
    <Link
      href={href ?? `/gastos/${e.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <CategoryIcon icon={e.category_icon} color={e.category_color} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{title}</span>
          {e.is_locked ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Periodo cerrado" /> : null}
          {e.has_attachment ? <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Con recibo" /> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
      </div>
      <div className="text-right">
        <Money amount={e.amount} currency={e.currency} locale={locale} className="text-sm font-semibold" />
        {e.scope === "shared" && (e.split_count ?? 1) > 1 ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            tu parte {formatMoney(e.share_amount ?? e.amount, e.currency, locale)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

/** Gastos agrupados por día, con el total de cada día. */
export function ExpenseList({
  expenses,
  userId,
  locale,
  className,
  showTotals = true,
}: {
  expenses: Row[];
  userId: string;
  locale: string;
  className?: string;
  showTotals?: boolean;
}) {
  const days = new Map<string, Row[]>();
  for (const e of expenses) days.set(e.expense_date, [...(days.get(e.expense_date) ?? []), e]);

  return (
    <div className={cn("space-y-5", className)}>
      {[...days.entries()].map(([day, rows]) => {
        const totals = new Map<string, number>();
        for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.amount);
        return (
          <section key={day} aria-label={formatDayHeading(day)}>
            <div className="mb-1 flex items-baseline justify-between px-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase first-letter:uppercase">
                {formatDayHeading(day)}
              </h3>
              {showTotals ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {[...totals.entries()].map(([c, t]) => formatMoney(t, c, locale)).join(" · ")}
                </span>
              ) : null}
            </div>
            <div className="divide-y divide-border/60">
              {rows.map((e) => (
                <ExpenseRow key={e.id} e={e} userId={userId} locale={locale} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
