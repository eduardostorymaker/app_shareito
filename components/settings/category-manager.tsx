"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { createCategory, setCategoryArchived, updateCategory } from "@/lib/actions/settings";
import { getCategoryIcon, PICKABLE_COLORS, PICKABLE_ICONS } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

type Scope = { key: string; label: string };
const NO_PARENT = "none";

export function CategoryManager({
  scopes,
  custom,
  systemRoots,
}: {
  scopes: Scope[];
  custom: Category[];
  systemRoots: Category[];
}) {
  const [scope, setScope] = useState(scopes[0]!.key);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const groupId = scope === "personal" ? null : scope;
  const inScope = useMemo(
    () => custom.filter((c) => (groupId ? c.group_id === groupId : c.group_id === null)),
    [custom, groupId],
  );
  const byId = new Map([...custom, ...systemRoots].map((c) => [c.id, c]));
  const parents = [...systemRoots, ...inScope.filter((c) => !c.parent_id && !c.archived_at)];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {scopes.length > 1 ? (
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-10 w-full sm:w-64" aria-label="Ámbito">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopes.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span />
        )}
        <Button className="h-10" onClick={() => setEditing("new")}>
          <Plus /> Nueva categoría
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {groupId
          ? "Las categorías del grupo las ven y usan todos sus miembros, solo en gastos de ese grupo."
          : "Tus categorías personales solo aparecen en tus gastos personales."}
      </p>

      {inScope.length ? (
        <ul className="divide-y rounded-xl border">
          {inScope.map((c) => {
            const parent = c.parent_id ? byId.get(c.parent_id) : undefined;
            return (
              <li key={c.id} className={cn("flex items-center gap-3 px-4 py-3", c.archived_at && "opacity-60")}>
                <CategoryIcon icon={c.icon} color={c.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{parent ? `Dentro de ${parent.name}` : "Categoría principal"}</span>
                </span>
                {c.archived_at ? <Badge variant="outline">Archivada</Badge> : null}
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={c.archived_at ? `Reactivar ${c.name}` : `Archivar ${c.name}`}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setCategoryArchived(c.id, !c.archived_at);
                      if (res.ok) toast.success(c.archived_at ? "Categoría reactivada" : "Categoría archivada: ya no aparece al registrar gastos");
                      else toast.error(res.message);
                    })
                  }
                >
                  {c.archived_at ? <ArchiveRestore /> : <Archive />}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={getCategoryIcon("tag")}
          title="Sin categorías propias"
          description="Las 17 categorías del sistema cubren lo habitual. Crea una propia si te falta algo concreto."
        />
      )}

      <CategoryDialog
        key={editing === "new" ? `new-${scope}` : (editing?.id ?? "closed")}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        category={editing === "new" ? null : editing}
        groupId={groupId}
        parents={parents}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  groupId,
  parents,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: Category | null;
  groupId: string | null;
  parents: Category[];
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? PICKABLE_COLORS[0]!);
  const [parentId, setParentId] = useState(category?.parent_id ?? NO_PARENT);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = category
        ? await updateCategory(category.id, { name, icon, color })
        : await createCategory({ name, icon, color, parent_id: parentId === NO_PARENT ? null : parentId, group_id: groupId });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.success(category ? "Categoría actualizada" : "Categoría creada");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>Elige un nombre corto, un icono y un color.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-3">
            <CategoryIcon icon={icon} color={color} size="lg" />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="h-10" />
            </div>
          </div>
          {!category ? (
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Categoría principal</SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Dentro de {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Icono</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {PICKABLE_ICONS.map((i) => {
                const Icon = getCategoryIcon(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={i}
                    aria-pressed={icon === i}
                    onClick={() => setIcon(i)}
                    className={cn("flex size-9 items-center justify-center rounded-lg border hover:bg-muted", icon === i && "border-primary bg-primary/10")}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PICKABLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn("size-7 rounded-full ring-offset-2 ring-offset-background", color === c && "ring-2 ring-foreground")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
