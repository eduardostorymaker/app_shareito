"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComposer, type ExpenseDraft } from "@/components/expenses/composer-context";
import { deleteExpense, restoreExpense } from "@/lib/actions/expenses";

export function ExpenseActions({ draft, deleted }: { draft: ExpenseDraft & { id: string }; deleted: boolean }) {
  const { openComposer } = useComposer();
  const [pending, startTransition] = useTransition();

  if (deleted) {
    return (
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await restoreExpense(draft.id);
            if (res.ok) toast.success("Gasto restaurado");
            else toast.error(res.message);
          })
        }
      >
        <RotateCcw /> Restaurar
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => openComposer({ mode: "edit", draft })}>
        <Pencil /> {draft.is_locked ? "Ver" : "Editar"}
      </Button>
      {draft.is_locked ? null : (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteExpense(draft.id);
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast("Gasto enviado a la papelera", {
                action: {
                  label: "Deshacer",
                  onClick: async () => {
                    const r = await restoreExpense(draft.id);
                    if (r.ok) toast.success("Gasto restaurado");
                    else toast.error(r.message);
                  },
                },
              });
            })
          }
        >
          <Trash2 /> Eliminar
        </Button>
      )}
    </div>
  );
}
