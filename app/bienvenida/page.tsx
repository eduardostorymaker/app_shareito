import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingForm } from "@/components/settings/onboarding-form";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "Bienvenida" };

export default function WelcomePage() {
  return (
    <AuthShell>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Content />
      </Suspense>
    </AuthShell>
  );
}

async function Content() {
  const profile = await getProfile();
  if (profile.onboarded_at) redirect("/");
  return <OnboardingForm name={profile.display_name} currency={profile.currency} />;
}
