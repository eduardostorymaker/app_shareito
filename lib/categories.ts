import type { Category } from "@/lib/types";

/** Slug de la única subcategoría del sistema que no se puede ocultar. */
export const ALWAYS_VISIBLE_SLUG = "otros-sin-categoria";

/**
 * Categorías que se ofrecen en el formulario de gasto, quitando las que el usuario ocultó.
 *
 * - Se ocultan subcategorías; una categoría principal del sistema desaparece cuando
 *   todas sus subcategorías están ocultas.
 * - `keepId` se conserva aunque esté oculta: es la categoría actual de un gasto que se
 *   está editando, para que no se pierda al abrir el formulario.
 */
export function withoutHidden(categories: Category[], hiddenIds: ReadonlySet<string>, keepId?: string | null): Category[] {
  if (!hiddenIds.size) return categories;

  const keep = keepId ? categories.find((c) => c.id === keepId) : undefined;
  const isHidden = (c: Category) => hiddenIds.has(c.id) && c.id !== keep?.id;

  const childrenOf = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parent_id) childrenOf.set(c.parent_id, [...(childrenOf.get(c.parent_id) ?? []), c]);
  }

  return categories.filter((c) => {
    if (c.parent_id) return !isHidden(c);
    const children = childrenOf.get(c.id);
    // Categoría principal sin subcategorías (p. ej. una propia): se queda.
    if (!children?.length) return true;
    // Principal con subcategorías: se queda si alguna sigue visible.
    return children.some((child) => !isHidden(child));
  });
}
