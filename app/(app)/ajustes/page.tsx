import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Tags, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { getProfile } from "@/lib/auth";
import { getMyGroups } from "@/lib/queries";
import { signOut } from "@/lib/actions/auth";
import { describeClosing } from "@/lib/periods";

export const metadata = { title: "Ajustes" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={6} />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const [profile, groups] = await Promise.all([getProfile(), getMyGroups()]);

  return (
    <div className="space-y-8">
      <PageHeader title="Ajustes" description={profile.email} />

      <Card>
        <CardContent>
          <ProfileForm
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
            initial={{
              display_name: profile.display_name,
              currency: profile.currency,
              timezone: profile.timezone,
              default_scope: profile.default_scope as "personal" | "shared",
              default_group_id: profile.default_group_id,
              default_payment_method: profile.default_payment_method,
            }}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">Grupos</h2>
        <div className="divide-y rounded-xl border">
          {groups.map((g) => (
            <Link key={g.id} href={`/ajustes/grupos/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{g.name}</span>
                <span className="block text-xs text-muted-foreground">{describeClosing(g.closing_type, g.closing_day)}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
          <Link href="/grupos?nuevo=1" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-primary hover:bg-muted/50">
            <Users className="size-4" /> Crear un grupo
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Más</h2>
        <div className="divide-y rounded-xl border">
          <Link href="/ajustes/categorias" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
            <Tags className="size-4 text-muted-foreground" />
            <span className="flex-1">Categorías propias</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Link href="/papelera" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50">
            <Trash2 className="size-4 text-muted-foreground" />
            <span className="flex-1">Papelera</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>Tema</span>
            <ThemeSwitcher />
          </div>
        </div>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-full sm:w-auto">
          <LogOut /> Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
