"use client";

import { useRouter } from "next/navigation";
import { GroupForm } from "@/components/groups/group-form";

export function GroupEditForm(props: Omit<React.ComponentProps<typeof GroupForm>, "onDone">) {
  const router = useRouter();
  return <GroupForm {...props} onDone={() => router.refresh()} />;
}
