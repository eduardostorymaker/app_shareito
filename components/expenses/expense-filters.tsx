"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOptions = {
  groups: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

export const RANGE_OPTIONS = [
  { value: "todo", label: "Todas las fechas" },
  { value: "mes", label: "Este mes" },
  { value: "mes-pasado", label: "Mes pasado" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "anio", label: "Este año" },
  { value: "custom", label: "Personalizado" },
] as const;

const ALL = "all";

export function ExpenseFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(() => ["tipo", "grupo", "categoria", "rango"].some((k) => params.has(k)));
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    next.delete("limite");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  const range = params.get("rango") ?? "todo";
  const activeCount = ["tipo", "grupo", "categoria", "rango"].filter((k) => params.has(k)).length;

  return (
    <div className={cn("space-y-3", pending && "opacity-70 transition-opacity")}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            placeholder="Buscar por descripción, comercio o categoría"
            aria-label="Buscar gastos"
            className="h-10 pl-9"
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              clearTimeout(debounce.current);
              debounce.current = setTimeout(() => update({ q: v.trim() || null }), 350);
            }}
          />
        </div>
        <Button
          type="button"
          variant={open || activeCount ? "secondary" : "outline"}
          className="h-10"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeCount}</span> : null}
        </Button>
      </div>

      {open ? (
        <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <FilterSelect
            label="Fechas"
            value={range}
            onChange={(v) => update({ rango: v === "todo" ? null : v, desde: null, hasta: null })}
            items={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
          />
          <FilterSelect
            label="Tipo"
            value={params.get("tipo") ?? ALL}
            onChange={(v) => update({ tipo: v, grupo: v === "personal" ? null : params.get("grupo") })}
            items={[
              { value: ALL, label: "Personales y compartidos" },
              { value: "personal", label: "Solo personales" },
              { value: "compartido", label: "Solo compartidos" },
            ]}
          />
          {options.groups.length ? (
            <FilterSelect
              label="Grupo"
              value={params.get("grupo") ?? ALL}
              onChange={(v) => update({ grupo: v, tipo: v === ALL ? params.get("tipo") : "compartido" })}
              items={[{ value: ALL, label: "Todos los grupos" }, ...options.groups.map((g) => ({ value: g.id, label: g.name }))]}
            />
          ) : null}
          <FilterSelect
            label="Categoría"
            value={params.get("categoria") ?? ALL}
            onChange={(v) => update({ categoria: v })}
            items={[{ value: ALL, label: "Todas las categorías" }, ...options.categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <div className="space-y-1">
                <Label htmlFor="desde" className="text-xs text-muted-foreground">Desde</Label>
                <Input id="desde" type="date" className="h-10" defaultValue={params.get("desde") ?? ""} onChange={(e) => update({ desde: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hasta" className="text-xs text-muted-foreground">Hasta</Label>
                <Input id="hasta" type="date" className="h-10" defaultValue={params.get("hasta") ?? ""} onChange={(e) => update({ hasta: e.target.value || null })} />
              </div>
            </div>
          ) : null}
          {activeCount ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start sm:col-span-2"
              onClick={() => update({ tipo: null, grupo: null, categoria: null, rango: null, desde: null, hasta: null })}
            >
              <X /> Quitar filtros
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full">
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
    </div>
  );
}
