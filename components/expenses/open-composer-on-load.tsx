"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useComposer } from "@/components/expenses/composer-context";

/** Abre el formulario de gasto si la URL trae ?nuevo=1 (atajo de la PWA). */
export function OpenComposerOnLoad() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { openComposer } = useComposer();

  useEffect(() => {
    if (params.get("nuevo") !== "1") return;
    openComposer();
    router.replace(pathname, { scroll: false });
  }, [params, openComposer, router, pathname]);

  return null;
}
