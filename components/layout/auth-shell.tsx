import { ShareitoAppIcon, ShareitoWordmark } from "@/components/brand/logo";

/** Marco centrado de las pantallas de acceso y bienvenida. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <ShareitoAppIcon className="size-14 shadow-[0_12px_28px_-12px_rgba(80,56,224,0.6)]" />
        <div className="space-y-1">
          <ShareitoWordmark className="text-3xl leading-none text-foreground" />
          <p className="text-sm text-muted-foreground">Cuentas claras, amistades largas.</p>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
