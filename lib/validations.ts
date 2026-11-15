import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants";

const id = z.guid("Identificador no válido");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const expenseSchema = z
  .object({
    scope: z.enum(["personal", "shared"]),
    group_id: id.nullable().optional(),
    paid_by: id.optional(),
    category_id: id.refine(Boolean, "Elige una categoría"),
    amount: z.number("Escribe un importe").positive("El importe debe ser mayor que 0").max(9_999_999_999.99, "Importe demasiado alto"),
    expense_date: isoDate,
    payment_method: z.enum(PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]]),
    description: optionalText(200),
    merchant: optionalText(120),
    notes: optionalText(1000),
  })
  .refine((v) => v.scope === "personal" || Boolean(v.group_id), {
    path: ["group_id"],
    message: "Elige el grupo del gasto compartido",
  });

export type ExpenseInput = z.input<typeof expenseSchema>;

export const closingSchema = z
  .object({
    closing_type: z.enum(["end_of_month", "day_of_month"]),
    closing_day: z.number().int().min(1).max(28).nullable(),
  })
  .refine((v) => (v.closing_type === "end_of_month" ? v.closing_day === null : v.closing_day !== null), {
    path: ["closing_day"],
    message: "Elige un día entre 1 y 28",
  });

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre al grupo").max(60, "Máximo 60 caracteres"),
  description: optionalText(200),
  icon: z.string().max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  closing_type: z.enum(["end_of_month", "day_of_month"]),
  closing_day: z.number().int().min(1).max(28).nullable(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre").max(60, "Máximo 60 caracteres"),
  icon: z.string().max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  parent_id: id.nullable(),
  group_id: id.nullable(),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Escribe tu nombre").max(60, "Máximo 60 caracteres"),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().min(1).max(64),
  default_scope: z.enum(["personal", "shared"]),
  default_group_id: id.nullable(),
  default_payment_method: z.enum(PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]]),
});

export const passwordSchema = z.string().min(8, "Usa al menos 8 caracteres").max(72, "Máximo 72 caracteres");
export const emailSchema = z.email("Correo no válido");

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos del formulario.";
}
