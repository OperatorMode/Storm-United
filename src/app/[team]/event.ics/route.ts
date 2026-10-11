import { getTeam } from "@/lib/teams";
import { isEvent } from "@/lib/my-events";
import { canView } from "@/lib/session";

// "Add to my calendar" for an event: a one-event calendar file, for anyone the event is open to.
export async function GET(request: Request, ctx: RouteContext<"/[team]/event.ics">) {
  const event = await getTeam((await ctx.params).team);
  if (!event || !isEvent(event) || !event.event_starts_at || !(await canView(event))) return new Response("Not found", { status: 404 });
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = event.event_ends_at ?? new Date(new Date(event.event_starts_at).getTime() + 2 * 3600_000).toISOString();
  const url = new URL(`/${event.id}`, request.url).toString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sidelnr//My Event//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@sidelnr.app`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.event_starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.name)}`,
    event.event_place ? `LOCATION:${esc(event.event_place)}` : null,
    `DESCRIPTION:${esc([event.event_dress && `Dress code: ${event.event_dress}`, event.event_details, url].filter(Boolean).join("\n\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${event.id}.ics"` },
  });
}
