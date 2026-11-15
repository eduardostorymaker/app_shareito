import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUserId } from "@/lib/auth";
import type { Category, GroupBalance, GroupWithMembers, MemberInfo } from "@/lib/types";

/** Grupos donde el usuario es miembro activo, con sus miembros. */
export const getMyGroups = cache(async (opts?: { includeArchived?: boolean }): Promise<GroupWithMembers[]> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "*, group_members(user_id, role, left_at, profile:profiles!group_members_user_id_fkey(display_name, avatar_url))",
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((g) => g.group_members.some((m) => m.user_id === userId && m.left_at === null))
    .filter((g) => opts?.includeArchived || g.archived_at === null)
    .map(({ group_members, ...g }) => ({
      ...g,
      members: group_members
        .filter((m) => m.left_at === null)
        .map(
          (m): MemberInfo => ({
            user_id: m.user_id,
            role: m.role as MemberInfo["role"],
            display_name: m.profile?.display_name || "Sin nombre",
            avatar_url: m.profile?.avatar_url ?? null,
          }),
        )
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    }));
});

export const getGroup = cache(async (groupId: string): Promise<GroupWithMembers | null> => {
  const groups = await getMyGroups({ includeArchived: true });
  return groups.find((g) => g.id === groupId) ?? null;
});

/** Categorías visibles (sistema + propias + de mis grupos), sin archivar. */
export const getCategories = cache(async (): Promise<Category[]> => {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .is("archived_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data ?? [];
});

/** Categorías usadas recientemente por el usuario, de más a menos reciente. */
export const getRecentCategoryIds = cache(async (): Promise<string[]> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("category_id")
    .eq("created_by", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const seen = new Set<string>();
  for (const row of data ?? []) seen.add(row.category_id);
  return [...seen].slice(0, 8);
});

/**
 * Cierra los periodos vencidos (respaldo de pg_cron) y devuelve el balance en vivo.
 * Se llama al abrir la pantalla del grupo o al calcular la situación en Inicio.
 */
export const getGroupBalance = cache(async (groupId: string, closeDue = true): Promise<GroupBalance | null> => {
  await requireUserId();
  const supabase = await createClient();
  if (closeDue) await supabase.rpc("close_due_periods", { p_group_id: groupId });
  const { data, error } = await supabase.rpc("get_group_balance", { p_group_id: groupId });
  if (error) return null;
  return data as unknown as GroupBalance;
});

/** Nombres de perfiles visibles para el usuario (él mismo y compañeros de grupo). */
export async function getProfileNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
  for (const p of data ?? []) map.set(p.id, p.display_name || "Sin nombre");
  return map;
}
