import { Suspense } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposerProvider } from "@/components/expenses/composer-context";
import { ComposerLoader } from "@/components/expenses/composer-loader";
import { BottomNav, SideNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { getProfile } from "@/lib/auth";

async function UserMenuLoader({ compact }: { compact?: boolean }) {
  const profile = await getProfile();
  return <UserMenu name={profile.display_name || profile.email} email={profile.email} avatarUrl={profile.avatar_url} compact={compact} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ComposerProvider>
      <SideNav
        userMenu={
          <Suspense fallback={<Skeleton className="h-12 w-full rounded-lg" />}>
            <UserMenuLoader />
          </Suspense>
        }
      />

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-3.5" />
            </span>
            <span className="font-semibold tracking-tight">Gastos</span>
          </Link>
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <UserMenuLoader compact />
          </Suspense>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>

      <BottomNav />

      <Suspense fallback={null}>
        <ComposerLoader />
      </Suspense>
    </ComposerProvider>
  );
}
