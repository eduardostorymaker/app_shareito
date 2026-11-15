import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Desactivado a propósito. Todo el contenido depende de la sesión y espera a connection()
  // (ver lib/supabase/server.ts), así que el prefetch por sesión no adelanta nada y, además,
  // cada prefetch quedaba esperando ~10 s y bloqueaba las conexiones del navegador
  // (las Server Actions se quedaban en cola). Con false se prefetchea solo el armazón estático.
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
