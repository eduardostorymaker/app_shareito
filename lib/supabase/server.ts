import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Usa el JWT del usuario guardado en cookies: todas las consultas pasan por RLS.
 */
export async function createClient() {
  // El cliente de Supabase usa Date.now() al cargar la sesión, y eso no se admite en el
  // prefetch por sesión (cacheComponents + partialPrefetching). connection() deja los datos
  // del usuario para el momento de la petición; mientras, se ve el esqueleto de <Suspense>.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: no puede escribir cookies.
            // No importa, porque proxy.ts refresca la sesión en cada petición.
          }
        },
      },
    },
  );
}
