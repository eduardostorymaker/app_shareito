import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shareito",
    short_name: "Shareito",
    description: "Registra tus gastos personales y compartidos en segundos. Cuentas claras, amistades largas.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F6FD",
    theme_color: "#5038E0",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Nuevo gasto", url: "/?nuevo=1" }],
  };
}
