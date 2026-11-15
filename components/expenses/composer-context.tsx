"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** Valores de un gasto para editarlo o para precargar el formulario. */
export type ExpenseDraft = {
  id?: string;
  scope: "personal" | "shared";
  group_id: string | null;
  paid_by: string | null;
  category_id: string | null;
  amount: number | null;
  expense_date: string | null;
  payment_method: string | null;
  description: string | null;
  merchant: string | null;
  notes: string | null;
  is_locked?: boolean;
};

type OpenOptions =
  | { mode: "create"; groupId?: string | null; draft?: Partial<ExpenseDraft> }
  | { mode: "edit"; draft: ExpenseDraft };

type ComposerState = { open: boolean; options: OpenOptions; key: number };

type ComposerContextValue = {
  state: ComposerState;
  openComposer: (options?: OpenOptions) => void;
  setOpen: (open: boolean) => void;
};

const ComposerContext = createContext<ComposerContextValue | null>(null);

/** Estado global del formulario de gasto: lo abre el botón + desde cualquier pantalla. */
export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ComposerState>({ open: false, options: { mode: "create" }, key: 0 });

  const openComposer = useCallback((options: OpenOptions = { mode: "create" }) => {
    setState((s) => ({ open: true, options, key: s.key + 1 }));
  }, []);

  const setOpen = useCallback((open: boolean) => setState((s) => ({ ...s, open })), []);

  // Atajo de teclado: N abre un gasto nuevo (fuera de campos de texto).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      openComposer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openComposer]);

  const value = useMemo(() => ({ state, openComposer, setOpen }), [state, openComposer, setOpen]);
  return <ComposerContext value={value}>{children}</ComposerContext>;
}

export function useComposer() {
  const ctx = useContext(ComposerContext);
  if (!ctx) throw new Error("useComposer debe usarse dentro de ComposerProvider");
  return ctx;
}
