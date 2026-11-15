import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/shared/category-icon";
import { formatMoney } from "@/lib/format";

export type RankedItem = {
  key: string;
  label: string;
  value: number;
  count: number;
  icon?: string | null;
  color?: string | null;
  href?: string;
};

/**
 * Barras horizontales ordenadas, una sola tinta. La identidad la dan el icono y
 * el nombre; el importe y el porcentaje van escritos, así que nada depende del hover.
 */
export function RankedBars({ items, currency, locale }: { items: RankedItem[]; currency: string; locale: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <ul className="space-y-1">
      {items.map((it) => {
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        const content = (
          <>
            {it.icon !== undefined ? <CategoryIcon icon={it.icon} color={it.color} size="sm" /> : null}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{it.label}</span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(it.value, currency, locale)}
                  <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">{pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%</span>
                </span>
              </div>
              <div className="h-2 w-full" aria-hidden>
                <div className="h-2 rounded-r-[4px] bg-series-1" style={{ width: `${max > 0 ? Math.max((it.value / max) * 100, 1) : 0}%` }} />
              </div>
            </div>
            {it.href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link
                href={it.href}
                scroll={false}
                title={`${it.count} ${it.count === 1 ? "gasto" : "gastos"}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-2 py-2" title={`${it.count} ${it.count === 1 ? "gasto" : "gastos"}`}>
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
