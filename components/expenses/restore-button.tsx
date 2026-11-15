"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreExpense } from "@/lib/actions/expenses";

export function RestoreButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreExpense(id);
          if (res.ok) toast.success("Gasto restaurado");
          else toast.error(res.message);
        })
      }
    >
      <RotateCcw /> Restaurar
    </Button>
  );
}
