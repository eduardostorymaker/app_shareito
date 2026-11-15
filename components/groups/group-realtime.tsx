"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Refresca la pantalla del grupo cuando otro miembro registra o cambia un gasto. */
export function GroupRealtime({ groupId }: { groupId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      // La sesión vive en cookies: hay que dársela a Realtime antes de suscribirse;
      // si no, se une como anónimo y la RLS le niega los cambios.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`group-${groupId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `group_id=eq.${groupId}` }, () => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 400);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [groupId, router]);

  return null;
}
