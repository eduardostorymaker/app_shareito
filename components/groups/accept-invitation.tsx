"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/actions/groups";

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className="h-11 w-full text-base"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await acceptInvitation(token);
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success("Te uniste al grupo");
          router.push(`/grupos/${res.data.groupId}`);
        })
      }
    >
      {pending ? "Uniéndote…" : "Unirme al grupo"}
    </Button>
  );
}
