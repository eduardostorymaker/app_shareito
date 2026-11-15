import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/actions/result";

export const metadata = { title: "Iniciar sesión" };

const NOTICES: Record<string, string> = {
  oauth: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
  link: "El enlace no es válido o ya venció. Inicia sesión o pide uno nuevo.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? NOTICES[sp.error] : undefined;
  return <LoginForm next={safeNext(sp.next)} notice={error} />;
}
