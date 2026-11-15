"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatMoney } from "@/lib/format";

type Point = { month: string; label: string; total: number; count: number };

const config = { total: { label: "Gastado", color: "var(--series-1)" } } satisfies ChartConfig;

/** Evolución mensual: una sola serie, columnas finas con extremo redondeado. */
export function MonthlyChart({ data, currency, locale }: { data: Point[]; currency: string; locale: string }) {
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full" initialDimension={{ width: 600, height: 224 }}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeWidth={1} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="capitalize" />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compact.format(v)} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.5 }}
          content={({ active, payload }) => {
            const p = active && payload?.[0] ? (payload[0].payload as Point) : null;
            if (!p) return null;
            return (
              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-medium capitalize">{p.label}</p>
                <p className="tabular-nums">{formatMoney(p.total, currency, locale)}</p>
                <p className="text-muted-foreground">
                  {p.count} {p.count === 1 ? "gasto" : "gastos"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}
