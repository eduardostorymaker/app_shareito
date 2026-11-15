import { Suspense } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthShell } from "@/components/layout/auth-shell";
import { AcceptInvitation } from "@/components/groups/accept-invitation";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invitación" };

type Preview = {
  group_id: string;
  group_name: string;
  group_color: string;
  invited_by: string;
  member_count: number;
  is_valid: boolean;
};

export default function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  return (
    <AuthShell>
      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <Invitation params={params} />
      </Suspense>
    </AuthShell>
  );
}

async function Invitation({ params }: { params: PageProps<"/invitacion/[token]">["params"] }) {
  const [{ token }, userId] = await Promise.all([params, requireUserId()]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", { p_token: token });
  const preview = data as Preview | null;

  if (preview) {
    const { data: member } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", preview.group_id)
      .eq("user_id", userId)
      .is("left_at", null)
      .maybeSingle();
    if (member) {
      return (
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-semibold">Ya estás en {preview.group_name}</h1>
          <Button asChild className="h-11 w-full">
            <Link href={`/grupos/${preview.group_id}`}>Ir al grupo</Link>
          </Button>
        </div>
      );
    }
  }

  if (!preview || !preview.is_valid) {
    return (
      <div className="space-y-4 text-center">
        <CircleAlert className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Invitación no válida</h1>
        <p className="text-sm text-muted-foreground">El enlace venció, ya se usó o fue desactivado. Pide uno nuevo a quien te invitó.</p>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto block size-12 rounded-2xl" style={{ backgroundColor: preview.group_color }} aria-hidden />
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{preview.invited_by} te invita a</p>
        <h1 className="text-2xl font-semibold">{preview.group_name}</h1>
        <p className="text-sm text-muted-foreground">
          {preview.member_count} {preview.member_count === 1 ? "miembro" : "miembros"}
        </p>
      </div>
      <p className="rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
        Al unirte participarás a partes iguales en los gastos compartidos del periodo abierto, incluidos los registrados antes de tu llegada.
      </p>
      <AcceptInvitation token={token} />
    </div>
  );
}
