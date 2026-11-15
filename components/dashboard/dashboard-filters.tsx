"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "mes", label: "Este mes" },
  { value: "mes-pasado", label: "Mes pasado" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "anio", label: "Este año" },
  { value: "custom", label: "Personalizado" },
];

const ALL = "all";

/** Una fila de filtros sobre todo el panel; todos los gráficos usan el mismo corte. */
export function DashboardFilters({
  groups,
  currencies,
  children,
}: {
  groups: { id: string; name: string }[];
  currencies: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  const rango = params.get("rango") ?? "mes";
  const tipo = params.get("tipo") ?? ALL;
  const vista = params.get("vista") ?? "mia";

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <Pick value={rango} onChange={(v) => update({ rango: v === "mes" ? null : v, cat: null })} items={RANGES} label="Periodo" />
        <Pick
          value={tipo}
          onChange={(v) => update({ tipo: v, grupo: v === "personal" ? null : params.get("grupo") })}
          label="Tipo"
          items={[
            { value: ALL, label: "Todo" },
            { value: "personal", label: "Personal" },
            { value: "compartido", label: "Compartido" },
          ]}
        />
        {groups.length ? (
          <Pick
            value={params.get("grupo") ?? ALL}
            onChange={(v) => update({ grupo: v, tipo: v === ALL ? params.get("tipo") : "compartido" })}
            label="Grupo"
            items={[{ value: ALL, label: "Todos los grupos" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
          />
        ) : null}
        {groups.length && tipo !== "personal" ? (
          <Pick
            value={vista}
            onChange={(v) => update({ vista: v === "mia" ? null : v })}
            label="Importe"
            items={[
              { value: "mia", label: "Mi parte" },
              { value: "total", label: "Total del grupo" },
            ]}
          />
        ) : null}
        {currencies.length > 1 ? (
          <Pick
            value={params.get("moneda") ?? currencies[0]!}
            onChange={(v) => update({ moneda: v })}
            label="Moneda"
            items={currencies.map((c) => ({ value: c, label: c }))}
          />
        ) : null}
        {rango === "custom" ? (
          <div className="flex gap-2">
            <Input type="date" aria-label="Desde" className="h-9 w-40" defaultValue={params.get("desde") ?? ""} onChange={(e) => update({ desde: e.target.value || null })} />
            <Input type="date" aria-label="Hasta" className="h-9 w-40" defaultValue={params.get("hasta") ?? ""} onChange={(e) => update({ hasta: e.target.value || null })} />
          </div>
        ) : null}
      </div>
      {/* Mientras llega el nuevo corte se mantiene el anterior atenuado, sin saltos. */}
      <div className={cn("transition-opacity", pending && "pointer-events-none opacity-60")}>{children}</div>
    </>
  );
}

function Pick({
  value,
  onChange,
  items,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-0 gap-2" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
