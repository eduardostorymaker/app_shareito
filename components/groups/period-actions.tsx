"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, LockOpen, Lock, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { closeDuePeriods, markTransferPaid, reopenLastPeriod } from "@/lib/actions/groups";

export function ReopenPeriodButton({ groupId, period }: { groupId: string; period: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <LockOpen /> Reabrir periodo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reabrir el periodo {period}?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus gastos volverán a ser editables y el cierre automático quedará en pausa hasta que vuelvas a cerrarlo. Este cierre quedará en el historial como “reabierto”.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const res = await reopenLastPeriod(groupId);
                if (res.ok) toast.success("Periodo reabierto. Corrige lo necesario y vuelve a cerrarlo.");
                else toast.error(res.message);
              })
            }
          >
            Reabrir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RecloseButton({ groupId }: { groupId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await closeDuePeriods(groupId, true);
          if (!res.ok) toast.error(res.message);
          else toast.success(res.data.closed ? "Periodo cerrado de nuevo" : "Cierre automático reactivado");
        })
      }
    >
      <Lock /> {pending ? "Cerrando…" : "Volver a cerrar"}
    </Button>
  );
}

export function TransferPaidButton({ transferId, paid, canMark }: { transferId: string; paid: boolean; canMark: boolean }) {
  const [pending, startTransition] = useTransition();
  if (!canMark) return null;
  return (
    <Button
      size="sm"
      variant={paid ? "ghost" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markTransferPaid(transferId, !paid);
          if (!res.ok) toast.error(res.message);
          else toast.success(paid ? "Marcada como pendiente" : "Marcada como pagada");
        })
      }
    >
      {paid ? (
        <>
          <Undo2 /> Deshacer
        </>
      ) : (
        <>
          <Check /> Marcar pagada
        </>
      )}
    </Button>
  );
}
