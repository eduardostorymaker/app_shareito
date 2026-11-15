"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClosingDayPicker } from "@/components/groups/closing-day-picker";
import { CurrencySelect, TimezoneSelect } from "@/components/settings/pickers";
import { createGroup, updateGroup } from "@/lib/actions/groups";
import { GROUP_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Values = {
  name: string;
  description: string;
  color: string;
  currency: string;
  timezone: string;
  closing_type: "end_of_month" | "day_of_month";
  closing_day: number | null;
};

export function GroupForm({
  groupId,
  initial,
  onDone,
  submitLabel,
}: {
  groupId?: string;
  initial: Values;
  onDone?: (id: string) => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<Values>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(groupId);
  const set = <K extends keyof Values>(k: K, value: Values[K]) => setV((s) => ({ ...s, [k]: value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const base = {
        name: v.name,
        description: v.description || null,
        icon: "users",
        color: v.color,
        closing_type: v.closing_type,
        closing_day: v.closing_day,
      };
      const res = isEdit
        ? await updateGroup(groupId!, { ...base, timezone: v.timezone })
        : await createGroup({ ...base, currency: v.currency });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(isEdit ? "Grupo actualizado" : "Grupo creado");
      onDone?.(isEdit ? groupId! : (res.data as { id: string }).id);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="group-name">Nombre</Label>
        <Input id="group-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={60} required placeholder="Ej.: Casa, Viaje a Cusco" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="group-desc">Descripción (opcional)</Label>
        <Input id="group-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={200} className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {GROUP_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={v.color === c}
              onClick={() => set("color", c)}
              className={cn("size-8 rounded-full ring-offset-2 ring-offset-background transition", v.color === c && "ring-2 ring-foreground")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {isEdit ? (
        <div className="space-y-1.5">
          <Label>Zona horaria del grupo</Label>
          <TimezoneSelect value={v.timezone} onChange={(z) => set("timezone", z)} />
          <p className="text-xs text-muted-foreground">Define a qué hora termina el día de cierre. Moneda: {v.currency} (no se puede cambiar).</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>Moneda del grupo</Label>
          <CurrencySelect value={v.currency} onChange={(c) => set("currency", c)} />
          <p className="text-xs text-muted-foreground">Todos los gastos del grupo usarán esta moneda.</p>
        </div>
      )}
      <ClosingDayPicker
        type={v.closing_type}
        day={v.closing_day}
        onChange={(t, d) => setV((s) => ({ ...s, closing_type: t, closing_day: d }))}
      />
      {isEdit ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          El cambio se aplica desde el periodo abierto: empieza el día siguiente al último cierre y termina en la nueva fecha. Si quedara de menos de 7 días, se une al siguiente.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Guardando…" : (submitLabel ?? (isEdit ? "Guardar cambios" : "Crear grupo"))}
      </Button>
    </form>
  );
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  currency,
  timezone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  timezone: string;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo grupo</DialogTitle>
          <DialogDescription>Para compartir gastos con tu pareja, tu piso o un viaje. Después podrás invitar a los demás.</DialogDescription>
        </DialogHeader>
        <GroupForm
          initial={{ name: "", description: "", color: GROUP_COLORS[0]!, currency, timezone, closing_type: "end_of_month", closing_day: null }}
          onDone={(id) => {
            onOpenChange(false);
            router.push(`/ajustes/grupos/${id}?invitar=1`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
