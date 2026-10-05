import { getTeam } from "@/lib/teams";

// Each team's link installs as its own app ("Add to Home Screen" / "Install").
export async function GET(_: Request, ctx: RouteContext<"/[team]/manifest.webmanifest">) {
  const team = await getTeam((await ctx.params).team);
  if (!team) return new Response("Not found", { status: 404 });
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `/${team.id}/icon/${size}${purpose === "maskable" ? "?maskable=1" : ""}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return Response.json(
    {
      id: `/${team.id}`,
      name: team.name,
      short_name: team.name,
      description: `${team.name} — fixtures, attendance, MVP votes and the ladder.`,
      start_url: `/${team.id}`,
      scope: `/${team.id}`,
      display: "standalone",
      orientation: "portrait",
      background_color: team.primary_color,
      theme_color: team.primary_color,
      icons: [icon(192, "any"), icon(512, "any"), icon(512, "maskable")],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
