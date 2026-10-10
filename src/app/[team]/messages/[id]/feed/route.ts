import { getTeam } from "@/lib/teams";
import { canView, dmIdentities } from "@/lib/session";
import { getConversation, markRead, membersOf, messagesIn } from "@/lib/dms";

// Polled by an open conversation for new messages: GET ?after=<ISO timestamp>.
// Only for members of the conversation; reading it counts as read.
export async function GET(request: Request, ctx: RouteContext<"/[team]/messages/[id]/feed">) {
  const { team: teamId, id } = await ctx.params;
  const team = await getTeam(teamId);
  if (!team || !(await canView(team))) return new Response("Not found", { status: 404 });
  const ids = await dmIdentities(team);
  const conv = ids?.length ? await getConversation(team.id, id) : null;
  const me = conv ? (await membersOf([conv.id])).find((m) => ids!.includes(m.member) && !m.left_at)?.member : null;
  if (!conv || !me) return new Response("Not found", { status: 404 });
  const after = new URL(request.url).searchParams.get("after") ?? undefined;
  const fresh = await messagesIn(conv.id, after);
  if (fresh.length) await markRead(conv.id, me);
  return Response.json(fresh, { headers: { "Cache-Control": "no-store" } });
}
