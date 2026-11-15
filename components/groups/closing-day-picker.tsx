"use client";

import { cn } from "@/lib/utils";

/** Fin de mes (sin número) o un día fijo del 1 al 28. */
export function ClosingDayPicker({
  type,
  day,
  onChange,
  disabled,
}: {
  type: "end_of_month" | "day_of_month";
  day: number | null;
  onChange: (type: "end_of_month" | "day_of_month", day: number | null) => void;
  disabled?: boolean;
}) {
  const preview =
    type === "end_of_month"
      ? "Cada periodo va del día 1 al último día del mes (28, 29, 30 o 31, se calcula solo)."
      : day
        ? day === 28
          ? "Cada periodo cierra el día 28 y el siguiente empieza al día siguiente (29, o el 1 en febrero)."
          : `Cada periodo va del día ${day + 1} de un mes al ${day} del siguiente.`
        : "Elige el día de cierre.";

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Cierre de la contabilidad</legend>
      <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["end_of_month", "Fin de mes"],
            ["day_of_month", "Día fijo"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={type === v}
            onClick={() => onChange(v, v === "end_of_month" ? null : (day ?? 15))}
            className={cn(
              "h-9 rounded-lg text-sm font-medium transition-colors",
              type === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {type === "day_of_month" ? (
        <div role="radiogroup" aria-label="Día de cierre" className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={day === d}
              onClick={() => onChange("day_of_month", d)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors",
                day === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{preview}</p>
    </fieldset>
  );
}
