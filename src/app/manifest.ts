import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA. Instalável (standalone); não há service worker de cache
 * offline — o app exige conexão (dados financeiros sempre do servidor).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Meluno",
    short_name: "Meluno",
    description: "Organize gastos, compartilhe contas e descubra quem deve para quem.",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8ee",
    theme_color: "#172d40",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nova despesa", url: "/nova-despesa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Meus grupos", url: "/grupos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
