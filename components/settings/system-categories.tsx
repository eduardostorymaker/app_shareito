"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/shared/category-icon";
import { setCategoriesHidden, showAllCategories } from "@/lib/actions/settings";
import { ALWAYS_VISIBLE_SLUG } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Leaf = { id: string; name: string; icon: string; color: string; slug: string | null };
export type SystemRoot = { id: string; name: string; icon: string; color: string; children: Leaf[] };

/**
 * Categorías del sistema con un interruptor por categoría y subcategoría.
 * Se guarda qué subcategorías oculta el usuario; la principal se apaga ocultando todas las suyas.
 */
export function SystemCategories({ roots, hiddenIds }: { roots: SystemRoot[]; hiddenIds: string[] }) {
  const [hidden, setHidden] = useState(() => new Set(hiddenIds));
  const [open, setOpen] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hideable = (r: SystemRoot) => r.children.filter((c) => c.slug !== ALWAYS_VISIBLE_SLUG);
  const totalHidden = hidden.size;

  /** Cambio optimista: se ve al instante y se revierte si la base lo rechaza. */
  function apply(ids: string[], hide: boolean) {
    if (!ids.length) return;
    const before = new Set(hidden);
    const next = new Set(hidden);
    for (const id of ids) {
      if (hide) next.add(id);
      else next.delete(id);
    }
    setHidden(next);
    startTransition(async () => {
      const res = await setCategoriesHidden(ids, hide);
      if (!res.ok) {
        setHidden(before);
        toast.error(res.message);
      }
    });
  }

  function showAll() {
    const before = new Set(hidden);
    setHidden(new Set());
    startTransition(async () => {
      const res = await showAllCategories();
      if (!res.ok) {
        setHidden(before);
        toast.error(res.message);
      } else {
        toast.success("Todas las categorías vuelven a estar visibles");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {totalHidden === 0
            ? "Ves todas las categorías al registrar un gasto."
            : `${totalHidden} ${totalHidden === 1 ? "subcategoría oculta" : "subcategorías ocultas"} en tu formulario.`}
        </p>
        {totalHidden > 0 ? (
          <Button variant="outline" size="sm" onClick={showAll} disabled={pending}>
            <Eye /> Mostrar todas
          </Button>
        ) : null}
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {roots.map((r) => {
          const toggleable = hideable(r);
          const visibleCount = r.children.filter((c) => !hidden.has(c.id)).length;
          const rootOn = toggleable.some((c) => !hidden.has(c.id));
          const isOpen = open === r.id;
          const panelId = `subs-${r.id}`;
          return (
            <li key={r.id}>
              <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <CategoryIcon icon={r.icon} color={r.color} className={cn(!rootOn && "opacity-40")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-medium", !rootOn && "text-muted-foreground")}>{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {visibleCount === r.children.length
                        ? `${r.children.length} subcategorías`
                        : !rootOn
                          ? "Oculta"
                          : `${visibleCount} de ${r.children.length} visibles`}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </button>
                <Switch
                  checked={rootOn}
                  onCheckedChange={(on) => apply(toggleable.map((c) => c.id), !on)}
                  aria-label={`${rootOn ? "Ocultar" : "Mostrar"} ${r.name}`}
                />
              </div>
              {isOpen ? (
                <ul id={panelId} className="space-y-0.5 border-t bg-muted/30 px-3 py-2 sm:px-4">
                  {r.children.map((c) => {
                    const locked = c.slug === ALWAYS_VISIBLE_SLUG;
                    const on = !hidden.has(c.id);
                    return (
                      <li key={c.id} className="flex items-center gap-3 py-1.5 pl-6">
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" className={cn(!on && "opacity-40")} />
                        <span className={cn("min-w-0 flex-1 truncate text-sm", !on && "text-muted-foreground")}>
                          {c.name}
                          {locked ? <span className="ml-2 text-xs text-muted-foreground">Siempre visible</span> : null}
                        </span>
                        <Switch
                          size="sm"
                          checked={on}
                          disabled={locked}
                          onCheckedChange={(next) => apply([c.id], !next)}
                          aria-label={`${on ? "Ocultar" : "Mostrar"} ${c.name}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
