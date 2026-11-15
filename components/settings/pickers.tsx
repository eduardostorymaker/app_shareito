"use client";

import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants";

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const options = CURRENCIES.some((c) => c.code === value)
    ? CURRENCIES
    : [...CURRENCIES, { code: value, label: value, locale: "es" } as const];
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="w-10 font-medium tabular-nums">{c.code}</span>
            <span className="text-muted-foreground">{c.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const COMMON_ZONES = [
  "America/Lima", "America/Bogota", "America/Mexico_City", "America/Santiago", "America/Argentina/Buenos_Aires",
  "America/La_Paz", "America/Montevideo", "America/Asuncion", "America/Guatemala", "America/Costa_Rica",
  "America/Santo_Domingo", "America/Caracas", "America/Guayaquil", "America/Panama", "America/New_York",
  "America/Chicago", "America/Los_Angeles", "Europe/Madrid", "UTC",
];

export function TimezoneSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const zones = useMemo(() => {
    let all: string[] = COMMON_ZONES;
    try {
      all = Intl.supportedValuesOf("timeZone");
    } catch {
      // navegador antiguo: lista corta
    }
    const set = new Set([value, ...COMMON_ZONES, ...all]);
    return [...set];
  }, [value]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {zones.map((z) => (
          <SelectItem key={z} value={z}>
            {z.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
