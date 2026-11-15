"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComposer } from "@/components/expenses/composer-context";
import { cn } from "@/lib/utils";

export function NewExpenseButton({
  groupId,
  label = "Nuevo gasto",
  className,
  variant = "default",
}: {
  groupId?: string;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
}) {
  const { openComposer } = useComposer();
  return (
    <Button variant={variant} className={cn("h-10", className)} onClick={() => openComposer({ mode: "create", groupId })}>
      <Plus /> {label}
    </Button>
  );
}
