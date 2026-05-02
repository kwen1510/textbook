import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Textbook",
    short_name: "Textbook",
    description: "Private reading and study app with synced notes and recall practice.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f0e7",
    theme_color: "#78350f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
