import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SignUpForm } from "@/components/auth/auth-forms";
import { safeNext } from "@/lib/actions/result";

export const metadata = { title: "Crear cuenta" };

export default function SignUpPage({ searchParams }: PageProps<"/registro">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/registro">["searchParams"] }) {
  const sp = await searchParams;
  return <SignUpForm next={safeNext(sp.next)} />;
}
