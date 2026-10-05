import { getTeam } from "@/lib/teams";
import { generatedCrest } from "@/lib/brand";

// Generated crest for teams without an uploaded logo.
export async function GET(_: Request, ctx: RouteContext<"/[team]/crest.svg">) {
  const team = await getTeam((await ctx.params).team);
  if (!team) return new Response("Not found", { status: 404 });
  return new Response(generatedCrest(team), {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" },
  });
}
