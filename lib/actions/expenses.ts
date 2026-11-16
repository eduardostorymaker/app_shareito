"use server";

import { refresh as refreshRouter } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { expenseSchema, type ExpenseInput } from "@/lib/validations";
import { fail, invalid, ok, unauthenticated } from "@/lib/actions/result";
import type { ActionResult } from "@/lib/types";

const idSchema = z.guid();

/**
 * Refresca la vista del usuario tras un cambio. No usa revalidatePath: no hay datos
 * cacheados en el servidor que invalidar, y invalidar los armazones estáticos obligaba a
 * volver a prerenderizarlos (~10 s) mientras la siguiente acción quedaba en cola.
 */
function refresh() {
  refreshRouter();
}

export async function createExpense(input: ExpenseInput & { id?: string }): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const id = input.id && idSchema.safeParse(input.id).success ? input.id : crypto.randomUUID();

  const supabase = await createClient();
  // En gastos compartidos la base impone la moneda del grupo; en personales, la del perfil.
  const { data: profile } = await supabase.from("profiles").select("currency").eq("id", userId).single();

  const { error } = await supabase.from("expenses").insert({
    id,
    scope: v.scope,
    group_id: v.scope === "shared" ? v.group_id! : null,
    paid_by: v.scope === "shared" ? (v.paid_by ?? userId) : userId,
    category_id: v.category_id,
    amount: v.amount,
    currency: profile?.currency ?? "USD",
    expense_date: v.expense_date,
    payment_method: v.payment_method,
    description: v.description,
    merchant: v.merchant,
    notes: v.notes,
    created_by: userId,
  });
  if (error) return fail(error);

  refresh();
  return ok({ id });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  if (!idSchema.safeParse(id).success) return fail({ code: "PGRST116" });

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const patch: {
    scope: string; group_id: string | null; paid_by: string; category_id: string; amount: number;
    expense_date: string; payment_method: string; description: string | null; merchant: string | null;
    notes: string | null; currency?: string;
  } = {
    scope: v.scope,
    group_id: v.scope === "shared" ? v.group_id! : null,
    paid_by: v.scope === "shared" ? (v.paid_by ?? userId) : userId,
    category_id: v.category_id,
    amount: v.amount,
    expense_date: v.expense_date,
    payment_method: v.payment_method,
    description: v.description,
    merchant: v.merchant,
    notes: v.notes,
  };
  if (v.scope === "personal") {
    // Al pasar de compartido a personal, vuelve a la moneda del usuario.
    const { data: profile } = await supabase.from("profiles").select("currency").eq("id", userId).single();
    if (profile) patch.currency = profile.currency;
  }

  const { data, error } = await supabase.from("expenses").update(patch).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "PGRST116" });

  refresh();
  return ok({ id });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return setDeleted(id, true);
}

export async function restoreExpense(id: string): Promise<ActionResult> {
  return setDeleted(id, false);
}

async function setDeleted(id: string, deleted: boolean): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  if (!idSchema.safeParse(id).success) return fail({ code: "PGRST116" });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "PGRST116" });

  refresh();
  return ok(undefined);
}

const attachmentSchema = z.object({
  expense_id: z.guid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(200),
  mime_type: z.string().min(1).max(100),
  size_bytes: z.number().int().positive(),
});

/** Registra un recibo ya subido a Storage desde el navegador. */
export async function addAttachment(input: z.input<typeof attachmentSchema>): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.storage_path.startsWith(`${userId}/`)) return fail({ code: "42501" });

  const supabase = await createClient();
  const { error } = await supabase.from("expense_attachments").insert({ ...parsed.data, created_by: userId });
  if (error) return fail(error);

  refresh();
  return ok(undefined);
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!userId) return unauthenticated();
  if (!idSchema.safeParse(id).success) return fail({ code: "PGRST116" });

  const supabase = await createClient();
  const { data, error } = await supabase.from("expense_attachments").delete().eq("id", id).select("storage_path");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "PGRST116" });

  // Solo quien subió el archivo puede borrarlo de Storage; si no, queda huérfano pero inaccesible.
  await supabase.storage.from("receipts").remove([data[0]!.storage_path]);

  refresh();
  return ok(undefined);
}
