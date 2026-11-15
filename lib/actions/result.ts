import "server-only";
import type { z } from "zod";
import { translateError } from "@/lib/errors";
import { firstIssue } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: Parameters<typeof translateError>[0]): ActionResult<never> {
  return { ok: false, ...translateError(error) };
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, code: "VALIDATION", message: firstIssue(error) };
}

export function unauthenticated(): ActionResult<never> {
  return { ok: false, code: "UNAUTHENTICATED", message: "Tu sesión terminó. Vuelve a iniciar sesión." };
}

/** Solo rutas internas: evita redirecciones abiertas con ?next=https://... */
export function safeNext(next: unknown, fallback = "/"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
