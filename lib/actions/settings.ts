"use server";

import { refresh as refreshRouter } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { categorySchema, profileSchema } from "@/lib/validations";
import { localeForCurrency } from "@/lib/constants";
import { fail, invalid, ok, unauthenticated } from "@/lib/actions/result";
import type { ActionResult } from "@/lib/types";

/**
 * Refresca la vista del usuario tras un cambio. No usa revalidatePath: no hay datos
 * cacheados en el servidor que invalidar, y invalidar los armazones estáticos obligaba a
 * volver a prerenderizarlos (~10 s) mientras la siguiente acción quedaba en cola.
 */
function refresh() {
  refreshRouter();
}

const onboardingSchema = profileSchema.pick({ display_name: true, currency: true, timezone: true, default_scope: true });

export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...parsed.data,
      locale: localeForCurrency(parsed.data.currency),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return fail(error);

  refresh();
  return ok(undefined);
}

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (v.default_scope === "shared" && !v.default_group_id) {
    return { ok: false, code: "VALIDATION", message: "Elige el grupo que se usará por defecto." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...v,
      default_group_id: v.default_scope === "shared" ? v.default_group_id : null,
      locale: localeForCurrency(v.currency),
    })
    .eq("id", userId);
  if (error) return fail(error);

  refresh();
  return ok(undefined);
}

export async function createCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, owner_id: userId })
    .select("id")
    .single();
  if (error) return fail(error);

  refresh();
  return ok({ id: data.id });
}

const categoryUpdateSchema = categorySchema.pick({ name: true, icon: true, color: true });

export async function updateCategory(id: string, input: z.input<typeof categoryUpdateSchema>): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = categoryUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").update(parsed.data).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });

  refresh();
  return ok(undefined);
}

const idListSchema = z.array(z.guid()).min(1).max(200);

/**
 * Oculta o vuelve a mostrar subcategorías del sistema en el formulario del usuario.
 * La base rechaza las que no se pueden ocultar (principales, propias, "Sin categoría").
 */
export async function setCategoriesHidden(categoryIds: string[], hidden: boolean): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = idListSchema.safeParse(categoryIds);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = hidden
    ? await supabase
        .from("hidden_categories")
        .upsert(
          parsed.data.map((category_id) => ({ user_id: userId, category_id })),
          { onConflict: "user_id,category_id", ignoreDuplicates: true },
        )
    : await supabase.from("hidden_categories").delete().eq("user_id", userId).in("category_id", parsed.data);
  if (error) return fail(error);

  refresh();
  return ok(undefined);
}

/** Vuelve a mostrar todas las categorías del sistema. */
export async function showAllCategories(): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const supabase = await createClient();
  const { error } = await supabase.from("hidden_categories").delete().eq("user_id", userId);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });

  refresh();
  return ok(undefined);
}
