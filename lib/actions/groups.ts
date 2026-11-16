"use server";

import { refresh as refreshRouter } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/auth";
import { closingSchema, groupSchema } from "@/lib/validations";
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

async function session() {
  const userId = await getUserId();
  return userId ? { userId, supabase: await createClient() } : null;
}

export async function createGroup(input: z.input<typeof groupSchema>): Promise<ActionResult<{ id: string }>> {
  const s = await session();
  if (!s) return unauthenticated();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const closing = closingSchema.safeParse(parsed.data);
  if (!closing.success) return invalid(closing.error);

  const { data: profile } = await s.supabase.from("profiles").select("timezone").eq("id", s.userId).single();

  const { data, error } = await s.supabase
    .from("groups")
    .insert({ ...parsed.data, timezone: profile?.timezone ?? "UTC", created_by: s.userId })
    .select("id")
    .single();
  if (error) return fail(error);

  refresh();
  return ok({ id: data.id });
}

const groupUpdateSchema = groupSchema.omit({ currency: true }).extend({ timezone: z.string().min(1).max(64) });

export async function updateGroup(id: string, input: z.input<typeof groupUpdateSchema>): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  if (!idSchema.safeParse(id).success) return fail({ code: "PGRST116" });
  const parsed = groupUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const closing = closingSchema.safeParse(parsed.data);
  if (!closing.success) return invalid(closing.error);

  const { data, error } = await s.supabase.from("groups").update(parsed.data).eq("id", id).select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });

  refresh();
  return ok(undefined);
}

export async function setGroupArchived(id: string, archived: boolean): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { data, error } = await s.supabase
    .from("groups")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });
  refresh();
  return ok(undefined);
}

export async function createInvitation(
  groupId: string,
  opts: { maxUses: number; days: number },
): Promise<ActionResult<{ token: string }>> {
  const s = await session();
  if (!s) return unauthenticated();
  const maxUses = Math.min(Math.max(Math.trunc(opts.maxUses) || 1, 1), 50);
  const days = Math.min(Math.max(Math.trunc(opts.days) || 7, 1), 30);

  const { data, error } = await s.supabase
    .from("group_invitations")
    .insert({
      group_id: groupId,
      max_uses: maxUses,
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      created_by: s.userId,
    })
    .select("token")
    .single();
  if (error) return fail(error);

  refresh();
  return ok({ token: data.token });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { error } = await s.supabase
    .from("group_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function acceptInvitation(token: string): Promise<ActionResult<{ groupId: string }>> {
  const s = await session();
  if (!s) return unauthenticated();
  const { data, error } = await s.supabase.rpc("accept_group_invitation", { p_token: token });
  if (error) return fail(error);
  refresh();
  return ok({ groupId: data });
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { error } = await s.supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function setMemberRole(groupId: string, userId: string, role: "owner" | "member"): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { data, error } = await s.supabase
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });
  refresh();
  return ok(undefined);
}

export async function removeMember(groupId: string, userId: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { data, error } = await s.supabase
    .from("group_members")
    .update({ left_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .is("left_at", null)
    .select("user_id");
  if (error) return fail(error);
  if (!data?.length) return fail({ code: "42501" });
  refresh();
  return ok(undefined);
}

/** Cierra los periodos vencidos. Con releaseHold, un propietario vuelve a cerrar tras una reapertura. */
export async function closeDuePeriods(groupId: string, releaseHold = false): Promise<ActionResult<{ closed: number }>> {
  const s = await session();
  if (!s) return unauthenticated();
  const { data, error } = await s.supabase.rpc("close_due_periods", { p_group_id: groupId, p_release_hold: releaseHold });
  if (error) return fail(error);
  refresh();
  return ok({ closed: data });
}

export async function reopenLastPeriod(groupId: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { error } = await s.supabase.rpc("reopen_last_period", { p_group_id: groupId });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}

export async function markTransferPaid(transferId: string, paid: boolean): Promise<ActionResult> {
  const s = await session();
  if (!s) return unauthenticated();
  const { error } = await s.supabase.rpc("mark_transfer_paid", { p_transfer_id: transferId, p_paid: paid });
  if (error) return fail(error);
  refresh();
  return ok(undefined);
}
