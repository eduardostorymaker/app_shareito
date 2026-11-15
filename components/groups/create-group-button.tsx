"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateGroupDialog } from "@/components/groups/group-form";

export function CreateGroupButton({
  currency,
  timezone,
  defaultOpen = false,
  label = "Nuevo grupo",
  variant = "default",
}: {
  currency: string;
  timezone: string;
  defaultOpen?: boolean;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button variant={variant} className="h-10" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <CreateGroupDialog open={open} onOpenChange={setOpen} currency={currency} timezone={timezone} />
    </>
  );
}
