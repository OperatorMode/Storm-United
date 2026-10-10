import type { MetadataRoute } from "next";

// The family app: one Sidelnr icon for every team's games and the family's activities.
// Each team's own link still installs as that team's app (see [team]/manifest).
export default function manifest(): MetadataRoute.Manifest {
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `/app-icon/${size}${purpose === "maskable" ? "?maskable=1" : ""}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return {
    id: "/",
    name: "Sidelnr",
    short_name: "Sidelnr",
    description: "Every game for your kids’ teams: when, where, attendance, MVP votes and team chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [icon(192, "any"), icon(512, "any"), icon(512, "maskable")],
  };
}
