import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from "date-fns";
import { toISODate } from "@/lib/format";

/** Rango de fechas (inclusive) para un preset de filtro. `today` debe ser la fecha local del usuario. */
export function resolveRange(
  preset: string | undefined,
  today: Date,
  custom?: { from?: string; to?: string },
): { from: string; to: string; label: string } | null {
  const iso = toISODate;
  switch (preset) {
    case "mes":
      return { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)), label: "este mes" };
    case "mes-pasado": {
      const m = subMonths(today, 1);
      return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), label: "el mes pasado" };
    }
    case "3m":
      return { from: iso(startOfMonth(subMonths(today, 2))), to: iso(endOfMonth(today)), label: "los últimos 3 meses" };
    case "6m":
      return { from: iso(startOfMonth(subMonths(today, 5))), to: iso(endOfMonth(today)), label: "los últimos 6 meses" };
    case "anio":
      return { from: iso(startOfYear(today)), to: iso(endOfYear(today)), label: "este año" };
    case "custom": {
      const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
      const from = valid(custom?.from) ?? "2000-01-01";
      const to = valid(custom?.to) ?? "2999-12-31";
      return { from, to, label: "el rango elegido" };
    }
    default:
      return null;
  }
}

/** Mismo tamaño de rango, inmediatamente anterior (para comparar). */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  // Rangos de meses completos: compara con los mismos meses inmediatamente anteriores.
  if (f.getDate() === 1 && toISODate(endOfMonth(t)) === to) {
    const months = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth()) + 1;
    const pf = subMonths(f, months);
    return { from: toISODate(pf), to: toISODate(endOfMonth(subMonths(t, months))) };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  const pt = new Date(f.getTime() - 86_400_000);
  const pf = new Date(pt.getTime() - (days - 1) * 86_400_000);
  return { from: toISODate(pf), to: toISODate(pt) };
}
