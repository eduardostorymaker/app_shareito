"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useComposer } from "@/components/expenses/composer-context";
import { ExpenseForm, type ComposerData } from "@/components/expenses/expense-form";

/** Panel inferior en móvil, diálogo en escritorio. Siempre montado en el layout de la app. */
export function ExpenseComposer({ data }: { data: ComposerData }) {
  const { state, setOpen } = useComposer();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const title = state.options.mode === "edit" ? "Editar gasto" : "Nuevo gasto";
  const description = "Importe, categoría y guardar. Lo demás es opcional.";

  const form = <ExpenseForm key={state.key} data={data} options={state.options} onClose={() => setOpen(false)} />;

  if (isDesktop) {
    return (
      <Dialog open={state.open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90dvh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogTitle className="px-5 pt-5">{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={state.open} onOpenChange={setOpen} repositionInputs={false}>
      <DrawerContent className="flex h-[92dvh] max-h-[92dvh] flex-col">
        <DrawerTitle className="px-5 pt-2 text-left text-lg font-semibold">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        {form}
      </DrawerContent>
    </Drawer>
  );
}
