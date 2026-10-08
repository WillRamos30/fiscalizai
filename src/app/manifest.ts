import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FiscalizaI - Desempenho de Políticos",
    short_name: "FiscalizaI",
    description: "Avaliação objetiva de políticos brasileiros com dados públicos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#0e2357",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
