import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ClosingType } from "@/lib/types";

/** "Cierra a fin de mes" / "Cierra el día 15 de cada mes". */
export function describeClosing(type: string, day: number | null): string {
  if ((type as ClosingType) === "end_of_month" || !day) return "Cierra a fin de mes";
  return `Cierra el día ${day} de cada mes`;
}

/** Días que faltan hasta el cierre (0 = cierra hoy al terminar el día). */
export function daysUntil(periodEnd: string, todayIso: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(periodEnd), parseISO(todayIso)));
}

export function describeRemaining(days: number): string {
  if (days === 0) return "Cierra hoy";
  if (days === 1) return "Cierra mañana";
  return `Cierra en ${days} días`;
}
