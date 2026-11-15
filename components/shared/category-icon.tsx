import { createElement } from "react";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";

const SIZES = {
  sm: { box: "size-7", icon: "size-3.5" },
  md: { box: "size-9", icon: "size-4" },
  lg: { box: "size-11", icon: "size-5" },
} as const;

/** Icono de categoría sobre un círculo con su color al 15 %. */
export function CategoryIcon({
  icon,
  color,
  size = "md",
  className,
}: {
  icon: string | null | undefined;
  color: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const c = color || "#9CA3AF";
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", SIZES[size].box, className)}
      style={{ backgroundColor: `${c}26`, color: c }}
    >
      {createElement(getCategoryIcon(icon), { className: SIZES[size].icon, strokeWidth: 2.2 })}
    </span>
  );
}
