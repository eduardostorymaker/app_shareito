"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <TriangleAlert className="size-10 text-warning" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">No se pudo cargar esta pantalla</h1>
        <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo. Tus datos están a salvo.</p>
      </div>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
