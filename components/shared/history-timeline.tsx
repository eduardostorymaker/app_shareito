import { ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ExpenseChange } from "@/lib/audit";

export type TimelineItem = { id: string | number; title: string; at: string; changes?: ExpenseChange[] };

export function HistoryTimeline({ items, empty = "Sin cambios registrados." }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="relative space-y-5 border-l pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
          <p className="text-sm font-medium">{it.title}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(it.at)}</p>
          {it.changes?.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {it.changes.map((c) => (
                <li key={c.label} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-muted-foreground">{c.label}:</span>
                  {c.from ? (
                    <>
                      <span className="line-through decoration-muted-foreground/60">{c.from}</span>
                      <ArrowRight className="size-3 text-muted-foreground" aria-label="pasa a" />
                    </>
                  ) : null}
                  <span className="font-medium">{c.to}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
