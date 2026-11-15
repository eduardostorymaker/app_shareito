"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // false en el servidor y en la hidratación; true después (el tema solo se conoce en el navegador).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div role="radiogroup" aria-label="Tema" className="flex gap-1 rounded-lg bg-muted p-1">
      {(
        [
          ["light", Sun, "Claro"],
          ["dark", Moon, "Oscuro"],
          ["system", Monitor, "Sistema"],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "flex size-8 items-center justify-center rounded-md transition-colors",
            current === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
