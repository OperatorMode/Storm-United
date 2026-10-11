import { cookies } from "next/headers";
import { getTeam } from "@/lib/teams";
import { isEvent } from "@/lib/my-events";
import { COOKIE_OPTS, inviteCookie, inviteSignature, joinCookie, joinToken } from "@/lib/session";

// An event invitation link: /<event>/join?by=<who invited>&s=<signature>.
// A valid link opens the event on this phone and remembers who invited it
// (an organiser's link lets people straight in; a guest's waits for an OK).
// A relative redirect: stays on whichever address the link was opened on.
const go = (path: string) => new Response(null, { status: 307, headers: { Location: path } });

export async function GET(request: Request, ctx: RouteContext<"/[team]/join">) {
  const { team: id } = await ctx.params;
  const url = new URL(request.url);
  const event = await getTeam(id);
  const by = url.searchParams.get("by") ?? "";
  const sig = url.searchParams.get("s") ?? "";
  if (!event || !isEvent(event) || !by || sig !== inviteSignature(event.id, by)) {
    return go("/?invite=invalid");
  }
  const store = await cookies();
  const token = joinToken(event);
  if (token) store.set(joinCookie(event.id), token, COOKIE_OPTS);
  // Keep an organiser's link once seen; otherwise the latest link wins.
  const current = store.get(inviteCookie(event.id))?.value ?? "";
  if (!current.startsWith("org.")) store.set(inviteCookie(event.id), `${by}.${sig}`, COOKIE_OPTS);
  return go(`/${event.id}`);
}
