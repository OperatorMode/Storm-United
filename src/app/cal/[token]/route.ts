import { calendarFor } from "@/lib/calendar";

// GET /cal/<token>.ics: a phone's game calendar for Apple/Google Calendar.
export async function GET(request: Request, ctx: RouteContext<"/cal/[token]">) {
  const { token } = await ctx.params;
  const url = new URL(request.url);
  const origin = `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host}`;
  const ics = await calendarFor(token.replace(/\.ics$/, ""), origin);
  if (!ics) return new Response("This calendar link isn’t valid any more.", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sidelnr.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}
