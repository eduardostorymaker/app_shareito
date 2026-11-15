"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencySelect, TimezoneSelect } from "@/components/settings/pickers";
import { updateProfile } from "@/lib/actions/settings";
import { PAYMENT_METHODS } from "@/lib/constants";

type Values = {
  display_name: string;
  currency: string;
  timezone: string;
  default_scope: "personal" | "shared";
  default_group_id: string | null;
  default_payment_method: string;
};

/** Valor de la opción “por defecto”: personal o un grupo concreto. */
const PERSONAL = "personal";

export function ProfileForm({ initial, groups }: { initial: Values; groups: { id: string; name: string }[] }) {
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const defaultValue = v.default_scope === "shared" && v.default_group_id ? v.default_group_id : PERSONAL;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateProfile(v);
      if (!res.ok) setError(res.message);
      else toast.success("Ajustes guardados");
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-semibold">Perfil</h2>
        <div className="space-y-1.5">
          <Label htmlFor="display_name">Nombre</Label>
          <Input id="display_name" value={v.display_name} onChange={(e) => setV({ ...v, display_name: e.target.value })} maxLength={60} className="h-11" />
          <p className="text-xs text-muted-foreground">Así te verán en tus grupos.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currency">Moneda de tus gastos personales</Label>
            <CurrencySelect id="currency" value={v.currency} onChange={(c) => setV({ ...v, currency: c })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz">Zona horaria</Label>
            <TimezoneSelect id="tz" value={v.timezone} onChange={(z) => setV({ ...v, timezone: z })} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Al registrar un gasto</h2>
          <p className="text-sm text-muted-foreground">Valores que aparecen preseleccionados. Siempre puedes cambiarlos en cada gasto.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="default-scope">Tipo por defecto</Label>
            <Select
              value={defaultValue}
              onValueChange={(val) =>
                setV({ ...v, default_scope: val === PERSONAL ? "personal" : "shared", default_group_id: val === PERSONAL ? null : val })
              }
            >
              <SelectTrigger id="default-scope" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL}>Personal</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    Compartido · {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-pm">Método de pago habitual</Label>
            <Select value={v.default_payment_method} onValueChange={(pm) => setV({ ...v, default_payment_method: pm })}>
              <SelectTrigger id="default-pm" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11" disabled={pending || !dirty}>
        {pending ? "Guardando…" : "Guardar ajustes"}
      </Button>
    </form>
  );
}
