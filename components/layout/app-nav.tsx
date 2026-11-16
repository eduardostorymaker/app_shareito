"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartPie, House, Plus, ReceiptText, Settings, Users } from "lucide-react";
import { ShareitoLogo } from "@/components/brand/logo";
import { useComposer } from "@/components/expenses/composer-context";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/gastos", label: "Gastos", icon: ReceiptText },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/panel", label: "Panel", icon: ChartPie },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/*
 * usePathname() es dato de la URL: en rutas dinámicas debe ir dentro de <Suspense>.
 * El respaldo es la misma barra sin sección activa, así el armazón sigue siendo estático.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavView pathname={null} />}>
      <BottomNavWithPath />
    </Suspense>
  );
}

function BottomNavWithPath() {
  return <BottomNavView pathname={usePathname()} />;
}

export function SideNav({ userMenu }: { userMenu: React.ReactNode }) {
  return (
    <Suspense fallback={<SideNavView pathname={null} userMenu={userMenu} />}>
      <SideNavWithPath userMenu={userMenu} />
    </Suspense>
  );
}

function SideNavWithPath({ userMenu }: { userMenu: React.ReactNode }) {
  return <SideNavView pathname={usePathname()} userMenu={userMenu} />;
}

/** Barra inferior en móvil: cuatro secciones y el botón central de nuevo gasto. */
function BottomNavView({ pathname }: { pathname: string | null }) {
  const { openComposer } = useComposer();
  const [a, b, c, d] = ITEMS;

  const item = (it: (typeof ITEMS)[number]) => {
    const active = isActive(pathname, it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <it.icon className="size-5" strokeWidth={active ? 2.4 : 2} />
        {it.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {item(a)}
        {item(b)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => openComposer()}
            aria-label="Nuevo gasto"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform outline-none focus-visible:ring-ring active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        </div>
        {item(c)}
        {item(d)}
      </div>
    </nav>
  );
}

/** Barra lateral en escritorio. */
function SideNavView({ pathname, userMenu }: { pathname: string | null; userMenu: React.ReactNode }) {
  const { openComposer } = useComposer();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center px-2" aria-label="Shareito, inicio">
        <ShareitoLogo markClassName="size-8" wordmarkClassName="text-xl" />
      </Link>

      <button
        type="button"
        onClick={() => openComposer()}
        className="mb-4 flex h-10 items-center justify-between rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <span className="flex items-center gap-2">
          <Plus className="size-4" /> Nuevo gasto
        </span>
        <kbd className="rounded bg-primary-foreground/20 px-1.5 text-xs">N</kbd>
      </button>

      <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1">
        {[...ITEMS, { href: "/ajustes", label: "Ajustes", icon: Settings }].map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <it.icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {userMenu}
    </aside>
  );
}
