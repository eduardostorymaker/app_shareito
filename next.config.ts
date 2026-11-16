import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Desactivado: todo el contenido depende de la sesión y espera a connection()
  // (ver lib/supabase/server.ts), así que el prefetch por sesión no adelanta nada.
  // Se prefetchea solo el armazón estático.
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
