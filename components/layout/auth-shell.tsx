import { Wallet } from "lucide-react";

/** Marco centrado de las pantallas de acceso y bienvenida. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Wallet className="size-6" />
        </span>
        <div>
          <p className="text-lg font-semibold tracking-tight">Registro de Gastos</p>
          <p className="text-sm text-muted-foreground">Tus gastos y los compartidos, en segundos.</p>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
