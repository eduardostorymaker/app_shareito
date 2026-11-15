"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, ChevronDown, ChevronRight, Lock, Paperclip, Trash2, Users, User, X } from "lucide-react";
import { es } from "react-day-picker/locale";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "@/components/shared/category-icon";
import { CategoryPicker, selectableCategories } from "@/components/expenses/category-picker";
import { useComposer, type ExpenseDraft } from "@/components/expenses/composer-context";
import { createExpense, deleteExpense, restoreExpense, updateExpense } from "@/lib/actions/expenses";
import { uploadReceipt, validateReceipt } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatMoney, formatShortDate, parseAmount, toISODate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, MemberInfo } from "@/lib/types";

export type ComposerData = {
  userId: string;
  locale: string;
  currency: string;
  timezone: string;
  defaultScope: "personal" | "shared";
  defaultGroupId: string | null;
  defaultPaymentMethod: string;
  groups: { id: string; name: string; currency: string; color: string; members: MemberInfo[] }[];
  categories: Category[];
  recentCategoryIds: string[];
};

type Options = ReturnType<typeof useComposer>["state"]["options"];

/** Sugerencias para quien todavía no tiene historial. */
const STARTER_SLUGS = [
  "alimentacion-supermercado",
  "alimentacion-restaurantes",
  "transporte-taxi",
  "alimentacion-delivery",
  "transporte-combustible",
  "alimentacion-cafe",
];

function currencySymbol(currency: string, locale: string) {
  try {
    return (
      new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

function initialState(data: ComposerData, options: Options) {
  const draft: Partial<ExpenseDraft> = options.draft ?? {};
  const validGroup = (id: string | null | undefined) => (id && data.groups.some((g) => g.id === id) ? id : null);

  let scope: "personal" | "shared";
  let groupId: string | null;
  if (options.mode === "edit") {
    scope = draft.scope ?? "personal";
    groupId = draft.group_id ?? null;
  } else {
    const preferredGroup = validGroup(options.groupId) ?? validGroup(draft.group_id) ?? validGroup(data.defaultGroupId);
    scope = options.groupId ? "shared" : (draft.scope ?? data.defaultScope);
    groupId = preferredGroup ?? data.groups[0]?.id ?? null;
    if (scope === "shared" && !groupId) scope = "personal";
  }

  return {
    amountText: draft.amount != null ? String(draft.amount).replace(".", ",") : "",
    scope,
    groupId,
    paidBy: draft.paid_by ?? data.userId,
    categoryId: draft.category_id ?? null,
    date: draft.expense_date ?? todayISO(data.timezone),
    paymentMethod: draft.payment_method ?? data.defaultPaymentMethod,
    description: draft.description ?? "",
    merchant: draft.merchant ?? "",
    notes: draft.notes ?? "",
  };
}

export function ExpenseForm({ data, options, onClose }: { data: ComposerData; options: Options; onClose: () => void }) {
  const { openComposer } = useComposer();
  const isEdit = options.mode === "edit";
  const locked = isEdit && Boolean(options.draft.is_locked);
  const editId = isEdit ? options.draft.id : undefined;

  const [init] = useState(() => initialState(data, options));
  // Las recientes se fijan al abrir: si el servidor revalida con el formulario abierto,
  // los chips no deben moverse bajo el dedo del usuario.
  const [recentIds] = useState(() => data.recentCategoryIds);
  const [amountText, setAmountText] = useState(init.amountText);
  const [scope, setScope] = useState(init.scope);
  const [groupId, setGroupId] = useState(init.groupId);
  const [paidBy, setPaidBy] = useState(init.paidBy);
  const [categoryId, setCategoryId] = useState<string | null>(init.categoryId);
  const [date, setDate] = useState(init.date);
  const [paymentMethod, setPaymentMethod] = useState(init.paymentMethod);
  const [description, setDescription] = useState(init.description);
  const [merchant, setMerchant] = useState(init.merchant);
  const [notes, setNotes] = useState(init.notes);
  const [file, setFile] = useState<File | null>(null);
  const [showDetails, setShowDetails] = useState(Boolean(init.merchant || init.notes));
  const [view, setView] = useState<"form" | "categories">("form");
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const group = scope === "shared" ? data.groups.find((g) => g.id === groupId) : undefined;
  const currency = group?.currency ?? data.currency;
  const symbol = currencySymbol(currency, data.locale);

  // Categorías que verán todos los que vean el gasto.
  const available = useMemo(
    () =>
      data.categories.filter((c) =>
        c.is_system ||
        (scope === "personal" ? c.group_id === null && c.owner_id === data.userId : c.group_id === groupId),
      ),
    [data.categories, data.userId, scope, groupId],
  );
  const selectable = useMemo(() => selectableCategories(available), [available]);
  const byId = useMemo(() => new Map(available.map((c) => [c.id, c])), [available]);
  const category = categoryId ? byId.get(categoryId) : undefined;
  const parent = category?.parent_id ? byId.get(category.parent_id) : undefined;

  const quickCategories = useMemo(() => {
    const selectableIds = new Set(selectable.map((c) => c.id));
    const ids = recentIds.filter((id) => selectableIds.has(id));
    for (const slug of STARTER_SLUGS) {
      const c = selectable.find((x) => x.slug === slug);
      if (c && !ids.includes(c.id)) ids.push(c.id);
    }
    const list = ids.slice(0, 6);
    if (categoryId && selectableIds.has(categoryId) && !list.includes(categoryId)) list.unshift(categoryId);
    return list.map((id) => byId.get(id)!).filter(Boolean);
  }, [recentIds, selectable, byId, categoryId]);

  function changeScope(next: "personal" | "shared", nextGroup = groupId) {
    setScope(next);
    if (next === "shared") {
      setGroupId(nextGroup);
      const g = data.groups.find((x) => x.id === nextGroup);
      if (!g?.members.some((m) => m.user_id === paidBy)) setPaidBy(data.userId);
    } else {
      setPaidBy(data.userId);
    }
    // Si la categoría elegida no está disponible en el nuevo ámbito, se quita.
    const c = categoryId ? data.categories.find((x) => x.id === categoryId) : undefined;
    if (c && !c.is_system && (next === "personal" ? c.group_id !== null : c.group_id !== nextGroup)) setCategoryId(null);
  }

  function resetForAnother() {
    setAmountText("");
    setDescription("");
    setMerchant("");
    setNotes("");
    setFile(null);
    setCategoryId(null);
    setError(null);
    requestAnimationFrame(() => amountRef.current?.focus());
  }

  async function submit(addAnother: boolean) {
    if (locked || pending) return;
    setError(null);
    const amount = parseAmount(amountText);
    if (!amount || amount <= 0) {
      setError("Escribe el importe del gasto.");
      amountRef.current?.focus();
      return;
    }
    if (!categoryId) {
      setError("Elige una categoría.");
      return;
    }
    if (scope === "shared" && !groupId) {
      setError("Elige el grupo del gasto compartido.");
      return;
    }

    const input = {
      scope,
      group_id: scope === "shared" ? groupId : null,
      paid_by: scope === "shared" ? paidBy : data.userId,
      category_id: categoryId,
      amount,
      expense_date: date,
      payment_method: paymentMethod,
      description: description.trim() || null,
      merchant: merchant.trim() || null,
      notes: notes.trim() || null,
    } as const;
    const summary = `${formatMoney(amount, currency, data.locale)} · ${category?.name ?? "Gasto"}`;
    const receipt = file;

    if (isEdit && editId) {
      setPending(true);
      const res = await updateExpense(editId, input);
      if (!res.ok) {
        setPending(false);
        setError(res.message);
        return;
      }
      if (receipt) {
        const err = await uploadReceipt(data.userId, editId, receipt);
        if (err) toast.error(`Cambios guardados, pero el recibo no se subió: ${err}`);
      }
      toast.success("Cambios guardados", { description: summary });
      onClose();
      return;
    }

    // Alta: la interfaz responde al instante y el guardado sigue en segundo plano.
    const id = crypto.randomUUID();
    const toastId = toast.loading("Guardando gasto…", { description: summary });
    if (addAnother) resetForAnother();
    else onClose();

    const res = await createExpense({ ...input, id });
    if (!res.ok) {
      toast.error("No se guardó el gasto", { id: toastId, description: res.message });
      if (!addAnother) {
        openComposer({
          mode: "create",
          draft: { ...input, id: undefined, amount, is_locked: false },
        });
      }
      return;
    }

    if (receipt) {
      const err = await uploadReceipt(data.userId, id, receipt);
      if (err) toast.error(`El gasto se guardó, pero el recibo no: ${err}`);
    }

    toast.success("Gasto guardado", {
      id: toastId,
      description: summary,
      action: {
        label: "Deshacer",
        onClick: async () => {
          const undo = await deleteExpense(id);
          if (undo.ok) toast("Gasto eliminado");
          else toast.error(undo.message);
        },
      },
    });
  }

  async function remove() {
    if (!editId || locked) return;
    setPending(true);
    const res = await deleteExpense(editId);
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    onClose();
    toast("Gasto enviado a la papelera", {
      action: {
        label: "Deshacer",
        onClick: async () => {
          const r = await restoreExpense(editId);
          if (r.ok) toast.success("Gasto restaurado");
          else toast.error(r.message);
        },
      },
    });
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    const err = validateReceipt(f);
    if (err) {
      toast.error(err);
      return;
    }
    setFile(f);
  }

  if (view === "categories") {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-3 pb-4">
        <CategoryPicker
          categories={available}
          selectedId={categoryId}
          onBack={() => setView("form")}
          onSelect={(c) => {
            setCategoryId(c.id);
            setView("form");
            setError(null);
          }}
        />
      </div>
    );
  }

  const disabled = locked || pending;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-3 pb-4">
        {locked ? (
          <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="space-y-1">
              <p className="font-medium">Periodo cerrado</p>
              <p className="text-muted-foreground">
                Este gasto ya se liquidó. Para corregirlo, un propietario del grupo debe reabrir el periodo.
              </p>
              {groupId ? (
                <Link href={`/grupos/${groupId}`} onClick={onClose} className="font-medium text-primary underline-offset-4 hover:underline">
                  Ir al grupo
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Importe */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <label htmlFor="amount" className="sr-only">
            Importe
          </label>
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-2xl font-medium text-muted-foreground">{symbol}</span>
            <input
              id="amount"
              ref={amountRef}
              autoFocus={!isEdit}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="0,00"
              value={amountText}
              disabled={disabled}
              onChange={(e) => setAmountText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 16))}
              className="min-w-0 bg-transparent text-left text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40 disabled:opacity-60"
              style={{ width: `${Math.max(4, amountText.length) + 0.3}ch` }}
            />
          </div>
        </div>

        {/* Personal / compartido */}
        <div className="space-y-2">
          <div role="radiogroup" aria-label="Tipo de gasto" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { value: "personal", label: "Personal", icon: User },
                { value: "shared", label: group ? `Compartido · ${group.name}` : "Compartido", icon: Users },
              ] as const
            ).map((opt) => {
              const active = scope === opt.value;
              const noGroups = opt.value === "shared" && data.groups.length === 0;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled || noGroups}
                  onClick={() => changeScope(opt.value)}
                  className={cn(
                    "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors disabled:opacity-50",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <opt.icon className="size-4 shrink-0" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {data.groups.length === 0 && !isEdit ? (
            <p className="text-xs text-muted-foreground">
              Para compartir gastos,{" "}
              <Link href="/grupos" onClick={onClose} className="font-medium text-primary underline-offset-4 hover:underline">
                crea un grupo
              </Link>
              .
            </p>
          ) : null}
          {scope === "shared" && data.groups.length > 1 ? (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Grupo">
              {data.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={g.id === groupId}
                  disabled={disabled}
                  onClick={() => changeScope("shared", g.id)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                    g.id === groupId ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Categoría */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Categoría</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setView("categories")}
              className="flex items-center gap-0.5 text-sm font-medium text-primary disabled:opacity-50"
            >
              Ver todas <ChevronRight className="size-4" />
            </button>
          </div>
          {category ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setView("categories")}
              className="flex w-full items-center gap-3 rounded-xl border border-primary bg-primary/5 p-2.5 text-left ring-1 ring-primary"
            >
              <CategoryIcon icon={category.icon} color={category.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{category.name}</span>
                {parent ? <span className="block truncate text-xs text-muted-foreground">{parent.name}</span> : null}
              </span>
              <span className="text-xs text-muted-foreground">Cambiar</span>
            </button>
          ) : null}
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {quickCategories
              .filter((c) => c.id !== categoryId)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setCategoryId(c.id);
                    setError(null);
                  }}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border bg-background pr-3.5 pl-1.5 text-sm transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  {c.name}
                </button>
              ))}
          </div>
        </div>

        {/* Fecha, método, pagador */}
        <div className="grid grid-cols-2 gap-2">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" disabled={disabled} className="h-10 justify-start gap-2 font-normal">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="truncate capitalize">{formatShortDate(date)}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex gap-1 border-b p-2">
                {[0, 1].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() - offset);
                  const iso = offset === 0 ? todayISO(data.timezone) : toISODate(d);
                  return (
                    <Button
                      key={offset}
                      type="button"
                      size="sm"
                      variant={date === iso ? "secondary" : "ghost"}
                      onClick={() => {
                        setDate(iso);
                        setDateOpen(false);
                      }}
                    >
                      {offset === 0 ? "Hoy" : "Ayer"}
                    </Button>
                  );
                })}
              </div>
              <Calendar
                mode="single"
                locale={es}
                selected={parseISO(date)}
                defaultMonth={parseISO(date)}
                disabled={{ after: new Date() }}
                onSelect={(d) => {
                  if (d) {
                    setDate(toISODate(d));
                    setDateOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>

          <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={disabled}>
            <SelectTrigger className="h-10 w-full" aria-label="Método de pago">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {group ? (
            <div className="col-span-2 flex items-center gap-2">
              <Label htmlFor="paid-by" className="shrink-0 text-sm text-muted-foreground">
                Pagó
              </Label>
              <Select value={paidBy} onValueChange={setPaidBy} disabled={disabled}>
                <SelectTrigger id="paid-by" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {group.members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_id === data.userId ? `${m.display_name} (yo)` : m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          disabled={disabled}
          placeholder="Descripción (opcional)"
          aria-label="Descripción"
          className="h-10"
        />

        {/* Más detalles */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", showDetails && "rotate-180")} />
            Más detalles
          </button>
          {showDetails ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="merchant">Comercio</Label>
                <Input id="merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={120} disabled={disabled} placeholder="Ej.: Supermercado Central" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} disabled={disabled} rows={2} />
              </div>
            </div>
          ) : null}

          {!locked ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} aria-label="Quitar recibo" className="rounded p-1 hover:bg-muted">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => fileRef.current?.click()} disabled={disabled}>
                  <Paperclip /> Adjuntar recibo
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        {locked ? (
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button type="submit" className="h-11 w-full text-base" disabled={pending}>
              {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar"}
            </Button>
            {isEdit ? (
              <Button type="button" variant="ghost" className="h-10 w-full text-destructive hover:text-destructive" onClick={remove} disabled={pending}>
                <Trash2 /> Eliminar gasto
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="h-10 w-full" onClick={() => void submit(true)} disabled={pending}>
                Guardar y añadir otro
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
