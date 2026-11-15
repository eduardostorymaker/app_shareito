export const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "debit_card", label: "Tarjeta de débito" },
  { value: "credit_card", label: "Tarjeta de crédito" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "digital_wallet", label: "Billetera digital" },
  { value: "other", label: "Otro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

/** Monedas ofrecidas y el locale con el que se formatean (símbolo y separadores). */
export const CURRENCIES = [
  { code: "PEN", label: "Sol peruano", locale: "es-PE" },
  { code: "USD", label: "Dólar estadounidense", locale: "es-US" },
  { code: "EUR", label: "Euro", locale: "es-ES" },
  { code: "MXN", label: "Peso mexicano", locale: "es-MX" },
  { code: "COP", label: "Peso colombiano", locale: "es-CO" },
  { code: "CLP", label: "Peso chileno", locale: "es-CL" },
  { code: "ARS", label: "Peso argentino", locale: "es-AR" },
  { code: "BOB", label: "Boliviano", locale: "es-BO" },
  { code: "UYU", label: "Peso uruguayo", locale: "es-UY" },
  { code: "PYG", label: "Guaraní", locale: "es-PY" },
  { code: "GTQ", label: "Quetzal", locale: "es-GT" },
  { code: "CRC", label: "Colón costarricense", locale: "es-CR" },
  { code: "DOP", label: "Peso dominicano", locale: "es-DO" },
  { code: "VES", label: "Bolívar", locale: "es-VE" },
] as const;

export function localeForCurrency(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? "es";
}

export const GROUP_COLORS = [
  "#6366F1", "#0EA5E9", "#14B8A6", "#22C55E", "#F59E0B",
  "#F97316", "#EF4444", "#EC4899", "#A855F7", "#64748B",
];

export const GROUP_ICONS = ["users", "home", "heart", "plane", "briefcase", "baby", "gift", "car"] as const;

/** Tamaño máximo de recibo, igual que el límite del bucket en data_supabase.sql. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
