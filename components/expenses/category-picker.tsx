"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/shared/category-icon";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Una categoría es seleccionable si no tiene subcategorías. */
export function selectableCategories(categories: Category[]) {
  const parentIds = new Set(categories.map((c) => c.parent_id).filter(Boolean));
  return categories.filter((c) => !parentIds.has(c.id));
}

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  onBack,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (category: Category) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = categories.find((c) => c.id === selectedId);
  const [parentId, setParentId] = useState<string | null>(selected?.parent_id ?? null);

  const { roots, childrenOf, byId } = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const childrenOf = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parent_id) childrenOf.set(c.parent_id, [...(childrenOf.get(c.parent_id) ?? []), c]);
    }
    const roots = categories.filter((c) => !c.parent_id || !byId.has(c.parent_id));
    return { roots, childrenOf, byId };
  }, [categories]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return selectableCategories(categories)
      .filter((c) => {
        const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
        return normalize(c.name).includes(q) || (parent && normalize(parent.name).includes(q));
      })
      .slice(0, 30);
  }, [query, categories, byId]);

  const parent = parentId ? byId.get(parentId) : undefined;
  const children = parentId ? (childrenOf.get(parentId) ?? []) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (parentId && !query ? setParentId(null) : onBack())}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
          aria-label={parentId && !query ? "Volver a categorías" : "Volver al gasto"}
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoría"
            className="h-10 pl-9"
            aria-label="Buscar categoría"
          />
        </div>
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {query ? (
          results.length ? (
            <ul className="space-y-1">
              {results.map((c) => {
                const p = c.parent_id ? byId.get(c.parent_id) : undefined;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted",
                        c.id === selectedId && "bg-muted",
                      )}
                    >
                      <CategoryIcon icon={c.icon} color={c.color} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        {p ? <span className="block truncate text-xs text-muted-foreground">{p.name}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Ninguna categoría coincide con “{query}”.</p>
          )
        ) : parent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CategoryIcon icon={parent.icon} color={parent.color} size="sm" />
              <p className="font-medium">{parent.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    c.id === selectedId && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {roots.map((c) => {
              const hasChildren = (childrenOf.get(c.id)?.length ?? 0) > 0;
              const isActive = c.id === selectedId || (selected?.parent_id === c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => (hasChildren ? setParentId(c.id) : onSelect(c))}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-xs transition-colors hover:bg-muted",
                    isActive && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <span className="line-clamp-2 leading-tight">{c.name}</span>
                  {hasChildren ? (
                    <ChevronRight className="absolute top-1.5 right-1.5 size-3 text-muted-foreground" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
