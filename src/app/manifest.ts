import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home Screen" / "Install app"), opening
// full-screen with its own icon like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Storm United",
    short_name: "Storm United",
    description: "Storm United U10 — fixtures, attendance, MVP votes and the ladder.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
