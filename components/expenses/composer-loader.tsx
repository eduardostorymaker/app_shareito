import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getCategories, getMyGroups, getRecentCategoryIds } from "@/lib/queries";
import { ExpenseComposer } from "@/components/expenses/expense-composer";

/**
 * Carga los datos del formulario de gasto (perfil, grupos, categorías) dentro
 * de un <Suspense> del layout, y de paso exige haber completado la bienvenida.
 */
export async function ComposerLoader() {
  const profile = await getProfile();
  if (!profile.onboarded_at) redirect("/bienvenida");

  const [groups, categories, recentCategoryIds] = await Promise.all([
    getMyGroups(),
    getCategories(),
    getRecentCategoryIds(),
  ]);

  return (
    <ExpenseComposer
      data={{
        userId: profile.id,
        locale: profile.locale,
        currency: profile.currency,
        timezone: profile.timezone,
        defaultScope: profile.default_scope as "personal" | "shared",
        defaultGroupId: profile.default_group_id,
        defaultPaymentMethod: profile.default_payment_method,
        groups: groups.map((g) => ({ id: g.id, name: g.name, currency: g.currency, color: g.color, members: g.members })),
        categories,
        recentCategoryIds,
      }}
    />
  );
}
