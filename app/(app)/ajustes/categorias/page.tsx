import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { CategoryManager } from "@/components/settings/category-manager";
import { SystemCategories, type SystemRoot } from "@/components/settings/system-categories";
import { requireUserId } from "@/lib/auth";
import { getHiddenCategoryIds, getMyGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Categorías" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={8} />}>
      <Categories />
    </Suspense>
  );
}

async function Categories() {
  await requireUserId();
  const supabase = await createClient();
  const [groups, hiddenIds, { data: all }] = await Promise.all([
    getMyGroups(),
    getHiddenCategoryIds(),
    supabase.from("categories").select("*").order("sort_order").order("name"),
  ]);
  const categories = all ?? [];
  const system = categories.filter((c) => c.is_system);
  const roots: SystemRoot[] = system
    .filter((c) => !c.parent_id)
    .map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      color: r.color,
      children: system
        .filter((c) => c.parent_id === r.id)
        .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, slug: c.slug })),
    }));

  return (
    <div className="space-y-10">
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Categorías" />

      <section className="space-y-3" aria-labelledby="sys-h">
        <div className="space-y-1">
          <h2 id="sys-h" className="text-lg font-semibold">Categorías del sistema</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Desactiva las que no uses y dejarán de aparecer al registrar un gasto. Solo cambia para ti: tus gastos, el panel y
            lo que registran los demás en tus grupos se siguen viendo igual.
          </p>
        </div>
        <SystemCategories roots={roots} hiddenIds={hiddenIds} />
      </section>

      <section className="space-y-3" aria-labelledby="own-h">
        <div className="space-y-1">
          <h2 id="own-h" className="text-lg font-semibold">Mis categorías</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Crea categorías propias para lo que no esté en la lista. Las de un grupo las ven y usan todos sus miembros.
          </p>
        </div>
        <CategoryManager
          scopes={[{ key: "personal", label: "Personales" }, ...groups.map((g) => ({ key: g.id, label: `Grupo · ${g.name}` }))]}
          custom={categories.filter((c) => !c.is_system)}
          systemRoots={system.filter((c) => !c.parent_id)}
        />
      </section>
    </div>
  );
}
