import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/skeletons";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CreateGroupButton } from "@/components/groups/create-group-button";
import { getProfile } from "@/lib/auth";
import { getGroupBalance, getMyGroups } from "@/lib/queries";
import { describeSituation } from "@/lib/balance";
import { describeClosing } from "@/lib/periods";
import { cn } from "@/lib/utils";

export const metadata = { title: "Grupos" };

export default function GroupsPage({ searchParams }: PageProps<"/grupos">) {
  return (
    <Suspense fallback={<PageSkeleton cards={2} rows={0} />}>
      <Groups searchParams={searchParams} />
    </Suspense>
  );
}

async function Groups({ searchParams }: { searchParams: PageProps<"/grupos">["searchParams"] }) {
  const [profile, sp, groups] = await Promise.all([getProfile(), searchParams, getMyGroups({ includeArchived: true })]);
  const active = groups.filter((g) => !g.archived_at);
  const archived = groups.filter((g) => g.archived_at);
  const balances = await Promise.all(active.map((g) => getGroupBalance(g.id)));

  return (
    <div>
      <PageHeader
        title="Grupos"
        description="Gastos compartidos y quién le debe a quién."
        actions={<CreateGroupButton currency={profile.currency} timezone={profile.timezone} defaultOpen={sp.nuevo === "1"} />}
      />

      {active.length ? (
        <div className="grid gap-3">
          {active.map((g, i) => {
            const b = balances[i];
            const s = b ? describeSituation(b, profile.id, profile.locale) : null;
            return (
              <Link key={g.id} href={`/grupos/${g.id}`} className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50">
                <span className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{g.name}</p>
                    {b?.close_hold ? <Badge variant="outline">Periodo reabierto</Badge> : null}
                  </div>
                  <p className={cn("text-sm", s?.tone === "positive" ? "text-positive" : s?.tone === "negative" ? "text-negative" : "text-muted-foreground")}>
                    {s?.text ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {g.members.length} {g.members.length === 1 ? "miembro" : "miembros"} · {describeClosing(g.closing_type, g.closing_day)}
                  </p>
                </div>
                <div className="hidden -space-x-2 sm:flex">
                  {g.members.slice(0, 4).map((m) => (
                    <UserAvatar key={m.user_id} name={m.display_name} src={m.avatar_url} className="ring-2 ring-card" />
                  ))}
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Aún no tienes grupos"
          description="Crea un grupo para compartir gastos. Cada uno registra lo que paga y la app calcula quién le debe a quién al cierre."
          action={<CreateGroupButton currency={profile.currency} timezone={profile.timezone} label="Crear mi primer grupo" />}
        />
      )}

      {archived.length ? (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Archivados</h2>
          {archived.map((g) => (
            <Link key={g.id} href={`/grupos/${g.id}`} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50">
              {g.name}
              <ChevronRight className="size-4" />
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}
