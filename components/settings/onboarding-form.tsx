"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencySelect, TimezoneSelect, detectTimezone } from "@/components/settings/pickers";
import { completeOnboarding } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

export function OnboardingForm(props: { name: string; currency: string }) {
  // Moneda y zona horaria se detectan en el navegador: el formulario se pinta tras montar
  // para que el HTML del servidor y el del cliente coincidan.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <Skeleton className="h-96 w-full" />;
  return <OnboardingFields {...props} />;
}

function OnboardingFields({ name, currency }: { name: string; currency: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [cur, setCur] = useState(() => (currency === "USD" ? guessCurrency() : currency));
  const [timezone, setTimezone] = useState(() => detectTimezone());
  const [scope, setScope] = useState<"personal" | "shared">("personal");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding({ display_name: displayName, currency: cur, timezone, default_scope: scope });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.replace(scope === "shared" ? "/grupos?nuevo=1" : "/");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Te damos la bienvenida</h1>
        <p className="text-sm text-muted-foreground">Tres datos y empiezas. Podrás cambiarlos en Ajustes.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">¿Cómo te llamas?</Label>
        <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required className="h-11" />
      </div>

      <div className="space-y-1.5">
        <Label>Moneda principal</Label>
        <CurrencySelect value={cur} onChange={setCur} />
      </div>

      <div className="space-y-1.5">
        <Label>Zona horaria</Label>
        <TimezoneSelect value={timezone} onChange={setTimezone} />
        <p className="text-xs text-muted-foreground">Define qué día es “hoy” al registrar un gasto.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Cómo vas a usar la app?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { v: "personal", icon: User, t: "Solo mis gastos", d: "Por defecto, personal" },
              { v: "shared", icon: Users, t: "Compartir gastos", d: "Con pareja, piso, familia" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              aria-pressed={scope === o.v}
              onClick={() => setScope(o.v)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted",
                scope === o.v && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
            >
              <o.icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{o.t}</span>
              <span className="text-xs text-muted-foreground">{o.d}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
        {pending ? "Guardando…" : scope === "shared" ? "Continuar y crear un grupo" : "Empezar"}
      </Button>
    </form>
  );
}

function guessCurrency(): string {
  if (typeof navigator === "undefined") return "USD";
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  const map: Record<string, string> = {
    PE: "PEN", MX: "MXN", CO: "COP", CL: "CLP", AR: "ARS", BO: "BOB", UY: "UYU", PY: "PYG",
    GT: "GTQ", CR: "CRC", DO: "DOP", VE: "VES", ES: "EUR", US: "USD", EC: "USD", PA: "USD", SV: "USD",
  };
  return map[region] ?? "USD";
}
