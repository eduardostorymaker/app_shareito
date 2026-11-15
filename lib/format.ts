import { format, isToday, isYesterday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Formatea un importe con el símbolo de su moneda: "S/ 45.00", "$ 1.200", "45,00 €". */
export function formatMoney(amount: number, currency: string, locale = "es"): string {
  const key = `${locale}|${currency}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    } catch {
      f = new Intl.NumberFormat("es", { style: "currency", currency });
    }
    moneyFormatters.set(key, f);
  }
  // Evita "-0,00"
  return f.format(Math.abs(amount) < 0.005 ? 0 : amount);
}

/** Convierte lo que escribe el usuario ("45,5", "1.200,50", "1,200.50") en número. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // El separador que aparece último es el decimal.
    const dec = lastComma > lastDot ? "," : ".";
    const thousands = dec === "," ? "." : ",";
    s = s.split(thousands).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    // Solo comas: si hay exactamente 3 dígitos tras la última y más de una coma, son miles.
    const parts = s.split(",");
    s = parts.length > 2 ? parts.join("") : s.replace(",", ".");
  } else if (lastDot > -1) {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

// --- Fechas -----------------------------------------------------------------
// Las fechas de gasto son 'YYYY-MM-DD' sin hora. parseISO las interpreta en hora
// local, así que nunca se desplazan un día por la zona horaria.

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Hoy en la zona horaria indicada (o la del navegador/servidor). */
export function todayISO(timeZone?: string): string {
  if (!timeZone) return toISODate(new Date());
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return toISODate(new Date());
  }
}

export function formatDate(iso: string, pattern = "d MMM yyyy"): string {
  return format(parseISO(iso), pattern, { locale: es });
}

/** "Hoy", "Ayer", "lunes 3 de noviembre". */
export function formatDayHeading(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return format(d, thisYear ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatShortDate(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "d MMM", { locale: es });
}

export function formatDateTime(ts: string): string {
  return format(new Date(ts), "d MMM yyyy, HH:mm", { locale: es });
}

export function formatPeriod(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${format(s, sameYear ? "d MMM" : "d MMM yyyy", { locale: es })} – ${format(e, "d MMM yyyy", { locale: es })}`;
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Une nombres en español: "Ana", "Ana y Beto", "Ana, Beto y Caro". */
export function joinNames(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}
