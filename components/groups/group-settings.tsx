"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Crown, Link2, LogOut, MoreVertical, Share2, UserMinus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  createInvitation,
  leaveGroup,
  removeMember,
  revokeInvitation,
  setGroupArchived,
  setMemberRole,
} from "@/lib/actions/groups";
import { formatDateTime } from "@/lib/format";
import type { MemberInfo } from "@/lib/types";

export function MemberList({ groupId, members, meId, isOwner }: { groupId: string; members: MemberInfo[]; meId: string; isOwner: boolean }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(success);
      else toast.error(res.message);
    });

  return (
    <ul className="divide-y rounded-xl border">
      {members.map((m) => (
        <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
          <UserAvatar name={m.display_name} src={m.avatar_url} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {m.display_name}
            {m.user_id === meId ? <span className="font-normal text-muted-foreground"> (tú)</span> : null}
          </span>
          {m.role === "owner" ? (
            <Badge variant="secondary" className="gap-1">
              <Crown className="size-3" /> Propietario
            </Badge>
          ) : null}
          {isOwner && m.user_id !== meId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${m.display_name}`} disabled={pending}>
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {m.role === "owner" ? (
                  <DropdownMenuItem onSelect={() => run(() => setMemberRole(groupId, m.user_id, "member"), "Rol actualizado")}>
                    <Crown /> Quitar rol de propietario
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => run(() => setMemberRole(groupId, m.user_id, "owner"), `${m.display_name} ahora es propietario`)}>
                    <Crown /> Nombrar propietario
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onSelect={() => run(() => removeMember(groupId, m.user_id), `${m.display_name} ya no está en el grupo`)}>
                  <UserMinus /> Quitar del grupo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type Invitation = { id: string; token: string; max_uses: number; used_count: number; expires_at: string };

export function Invitations({
  groupId,
  invitations,
  siteUrl,
  highlight,
}: {
  groupId: string;
  invitations: Invitation[];
  siteUrl: string;
  highlight?: boolean;
}) {
  const [maxUses, setMaxUses] = useState("1");
  const [days, setDays] = useState("7");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const linkFor = (token: string) => `${siteUrl}/invitacion/${token}`;

  async function share(token: string) {
    const url = linkFor(token);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Únete a mi grupo en Shareito", url });
        return;
      } catch {
        // cancelado: se copia al portapapeles
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(token);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      {highlight ? (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm">Grupo creado. Ahora invita a las personas con las que compartes gastos.</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Usos</Label>
          <Select value={maxUses} onValueChange={setMaxUses}>
            <SelectTrigger className="h-10 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 persona</SelectItem>
              <SelectItem value="5">Hasta 5</SelectItem>
              <SelectItem value="20">Hasta 20</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Válido</Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-10 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 día</SelectItem>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="30">30 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="h-10"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await createInvitation(groupId, { maxUses: Number(maxUses), days: Number(days) });
              if (!res.ok) toast.error(res.message);
              else void share(res.data.token);
            })
          }
        >
          <Link2 /> Crear enlace
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Quien entre a mitad de periodo participa en el reparto de todos los gastos abiertos de ese periodo.
      </p>

      {invitations.length ? (
        <ul className="divide-y rounded-xl border">
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs">{linkFor(i.token)}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.used_count} de {i.max_uses} usos · vence {formatDateTime(i.expires_at)}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void share(i.token)}>
                {copied === i.token ? <Check /> : <Share2 />}
                Compartir
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Desactivar enlace"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await revokeInvitation(i.id);
                    if (res.ok) toast("Enlace desactivado");
                    else toast.error(res.message);
                  })
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function DangerZone({ groupId, groupName, isOwner, archived }: { groupId: string; groupName: string; isOwner: boolean; archived: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {isOwner ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await setGroupArchived(groupId, !archived);
              if (res.ok) toast.success(archived ? "Grupo reactivado" : "Grupo archivado");
              else toast.error(res.message);
            })
          }
        >
          {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Reactivar grupo" : "Archivar grupo"}
        </Button>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={pending}>
            <LogOut /> Salir del grupo
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir de {groupName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejarás de ver sus gastos. Si no pagaste nada en el periodo abierto, ya no contarás en el reparto, así que conviene salir justo después de un cierre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const res = await leaveGroup(groupId);
                  if (!res.ok) {
                    toast.error(res.message);
                    return;
                  }
                  toast("Saliste del grupo");
                  router.push("/grupos");
                })
              }
            >
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
