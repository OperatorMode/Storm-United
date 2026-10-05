import { getTeam } from "@/lib/teams";
import { canView } from "@/lib/session";
import { listChat } from "@/lib/messages";

// Polled by the open chat for new messages: GET ?after=<ISO timestamp>.
export async function GET(request: Request, ctx: RouteContext<"/[team]/chat/feed">) {
  const team = await getTeam((await ctx.params).team);
  if (!team || !(await canView(team))) return new Response("Not found", { status: 404 });
  const after = new URL(request.url).searchParams.get("after") ?? undefined;
  return Response.json(await listChat(team.id, after), { headers: { "Cache-Control": "no-store" } });
}
