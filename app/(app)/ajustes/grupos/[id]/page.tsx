import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { GroupEditForm } from "@/components/groups/group-edit-form";
import { DangerZone, Invitations, MemberList } from "@/components/groups/group-settings";
import { getProfile } from "@/lib/auth";
import { getGroup } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { describeClosing } from "@/lib/periods";

export const metadata = { title: "Configurar grupo" };

export default function GroupSettingsPage(props: PageProps<"/ajustes/grupos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={6} />}>
      <GroupSettings {...props} />
    </Suspense>
  );
}

async function GroupSettings({ params, searchParams }: PageProps<"/ajustes/grupos/[id]">) {
  const [{ id }, sp, profile] = await Promise.all([params, searchParams, getProfile()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const group = await getGroup(id);
  if (!group) notFound();

  const isOwner = group.members.some((m) => m.user_id === profile.id && m.role === "owner");
  const supabase = await createClient();
  const { data: invitations } = isOwner
    ? await supabase
        .from("group_invitations")
        .select("id, token, max_uses, used_count, expires_at, revoked_at")
        .eq("group_id", id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };
  const active = (invitations ?? []).filter((i) => i.used_count < i.max_uses);

  const h = await headers();
  // El dominio por el que entró el usuario (producción, preview o local).
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const siteUrl = host
    ? `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  return (
    <div className="space-y-6">
      <PageHeader back={{ href: `/grupos/${id}`, label: group.name }} title="Configurar grupo" description={group.archived_at ? "Archivado" : undefined} />

      {isOwner && !group.archived_at ? (
        <Card id="invitar">
          <CardHeader>
            <CardTitle>Invitar</CardTitle>
            <CardDescription>Crea un enlace y envíalo por WhatsApp, correo o como prefieras.</CardDescription>
          </CardHeader>
          <CardContent>
            <Invitations groupId={id} invitations={active} siteUrl={siteUrl} highlight={sp.invitar === "1"} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Miembros ({group.members.length})</CardTitle>
          <CardDescription>Los propietarios pueden configurar el grupo, invitar y reabrir periodos.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberList groupId={id} members={group.members} meId={profile.id} isOwner={isOwner} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos y cierre</CardTitle>
          {!isOwner ? <CardDescription>Solo los propietarios pueden cambiarlos.</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <GroupEditForm
              groupId={id}
              initial={{
                name: group.name,
                description: group.description ?? "",
                color: group.color,
                currency: group.currency,
                timezone: group.timezone,
                closing_type: group.closing_type as "end_of_month" | "day_of_month",
                closing_day: group.closing_day,
              }}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Moneda</dt>
                <dd>{group.currency}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cierre</dt>
                <dd>{describeClosing(group.closing_type, group.closing_day)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Zona horaria</dt>
                <dd>{group.timezone.replace(/_/g, " ")}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opciones del grupo</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone groupId={id} groupName={group.name} isOwner={isOwner} archived={Boolean(group.archived_at)} />
        </CardContent>
      </Card>
    </div>
  );
}
