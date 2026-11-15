import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Capa de acceso a datos para la sesión. `cache` evita repetir la consulta
 * cuando varios componentes de la misma petición piden el usuario.
 */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
});

export const requireUserId = cache(async (): Promise<string> => {
  const id = await getUserId();
  if (!id) redirect("/login");
  return id;
});

export const getProfile = cache(async (): Promise<Profile> => {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!data) redirect("/login");
  return data;
});
