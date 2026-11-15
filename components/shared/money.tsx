import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

type Tone = "default" | "positive" | "negative" | "muted" | "auto";

/** Importe con cifras tabulares. tone="auto": verde si es positivo, rojo si es negativo. */
export function Money({
  amount,
  currency,
  locale,
  tone = "default",
  signed = false,
  tabular = true,
  className,
}: {
  amount: number;
  currency: string;
  locale?: string;
  tone?: Tone;
  signed?: boolean;
  /** false en cifras grandes y aisladas: los dígitos de ancho fijo se ven sueltos. */
  tabular?: boolean;
  className?: string;
}) {
  const resolved = tone === "auto" ? (amount > 0.004 ? "positive" : amount < -0.004 ? "negative" : "muted") : tone;
  const text = formatMoney(signed ? Math.abs(amount) : amount, currency, locale);
  const sign = signed ? (amount > 0.004 ? "+" : amount < -0.004 ? "−" : "") : "";
  return (
    <span
      className={cn(
        "whitespace-nowrap",
        tabular && "tabular-nums",
        resolved === "positive" && "text-positive",
        resolved === "negative" && "text-negative",
        resolved === "muted" && "text-muted-foreground",
        className,
      )}
    >
      {sign}
      {text}
    </span>
  );
}
