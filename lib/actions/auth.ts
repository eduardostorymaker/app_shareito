"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema } from "@/lib/validations";
import { safeNext } from "@/lib/actions/result";

export type AuthFormState = { error?: string; message?: string; email?: string } | undefined;

async function siteUrl() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(message)) return "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (/already registered|already been registered/i.test(message)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/rate limit|too many/i.test(message)) return "Demasiados intentos. Espera un momento y vuelve a probar.";
  if (/password/i.test(message)) return "La contraseña no cumple los requisitos (mínimo 8 caracteres).";
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!emailSchema.safeParse(email).success) return { error: "Escribe un correo válido.", email };
  if (!password) return { error: "Escribe tu contraseña.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.message), email };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!name) return { error: "Escribe tu nombre.", email };
  if (!emailSchema.safeParse(email).success) return { error: "Escribe un correo válido.", email };
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { error: pw.error.issues[0]!.message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authErrorMessage(error.message), email };

  // Si el proyecto exige confirmar el correo, todavía no hay sesión.
  if (!data.session) {
    return { message: `Te enviamos un enlace a ${email}. Ábrelo para activar tu cuenta.`, email };
  }

  revalidatePath("/", "layout");
  redirect(next === "/" ? "/bienvenida" : next);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!emailSchema.safeParse(email).success) return { error: "Escribe un correo válido.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/actualizar-contrasena`,
  });
  if (error && /rate limit/i.test(error.message)) return { error: authErrorMessage(error.message), email };

  // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
  return { message: `Si existe una cuenta con ${email}, recibirás un enlace para crear una contraseña nueva.`, email };
}

export async function updatePassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return { error: pw.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.message) };

  redirect("/?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
