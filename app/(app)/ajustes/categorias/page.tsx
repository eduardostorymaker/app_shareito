import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { CategoryManager } from "@/components/settings/category-manager";
import { requireUserId } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Categorías" };

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={5} />}>
      <Categories />
    </Suspense>
  );
}

async function Categories() {
  await requireUserId();
  const supabase = await createClient();
  const [groups, { data: all }] = await Promise.all([
    getMyGroups(),
    supabase.from("categories").select("*").order("sort_order").order("name"),
  ]);
  const categories = all ?? [];

  return (
    <div>
      <PageHeader back={{ href: "/ajustes", label: "Ajustes" }} title="Categorías propias" />
      <CategoryManager
        scopes={[{ key: "personal", label: "Personales" }, ...groups.map((g) => ({ key: g.id, label: `Grupo · ${g.name}` }))]}
        custom={categories.filter((c) => !c.is_system)}
        systemRoots={categories.filter((c) => c.is_system && !c.parent_id)}
      />
    </div>
  );
}
