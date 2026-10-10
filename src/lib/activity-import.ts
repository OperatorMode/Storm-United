import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fetchText } from "./feeds";
import { cleanLink, readPage } from "./league-scan";
import { parseDate, parseTime, zonedTime } from "./fixtures";
import { saveActivity, sessionsFromIcs, type Activity, type ExtraSession } from "./activities";

// Importing an activity's dates from somewhere public: a calendar link (.ics,
// webcal, a Google Calendar share link) or any web page with the dates on it
// (a dance school's term timetable, a school sports calendar), read by AI.

const MAX_PAGE_CHARS = 150_000;

/** A Google Calendar "embed" or "cid" link → its public .ics address. */
function calendarLink(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "calendar.google.com") {
      const src = u.searchParams.get("src") ?? (u.searchParams.get("cid") ? Buffer.from(u.searchParams.get("cid")!, "base64").toString("utf8") : null);
      if (src && !u.pathname.includes("/ical/")) return `https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`;
    }
  } catch {}
  return url;
}

const Read = z.object({
  sessions: z
    .array(z.string())
    .describe('One line per session: "date|start time|minutes|title|place". Date YYYY-MM-DD, time 24-hour HH:MM, empty fields allowed, e.g. "2026-10-14|16:30|60|Junior Ballet|Studio 2"'),
  problem: z.string().nullable().describe("If no dates or times are on the page, a short reason; otherwise null"),
});

async function sessionsFromPage(text: string, url: string, tz: string, filter: string | null, activity: string): Promise<{ sessions: ExtraSession[]; problem: string | null }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Reading web pages isn’t switched on yet.");
  const today = new Date().toISOString().slice(0, 10);
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Read) },
    messages: [
      {
        role: "user",
        content: `Below is the text of a web page (${url}). A parent wants the dates and times of "${activity}"${
          filter ? `, only for: "${filter}"` : ""
        } in their family calendar.

List every session on the page from today (${today}) for the next 12 months. If the page gives a weekly timetable with term or season dates, list each week's sessions within those dates, skipping holidays the page mentions. Times are local. If a session's length isn't shown, leave minutes empty. Don't invent sessions.

<page>
${text.slice(0, MAX_PAGE_CHARS)}
</page>`,
      },
    ],
  });
  const res = await stream.finalMessage();
  if (res.stop_reason === "refusal") throw new Error("The page couldn’t be read.");
  const json = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let out: z.infer<typeof Read>;
  try {
    out = Read.parse(JSON.parse(json));
  } catch {
    throw new Error("The page couldn’t be read.");
  }
  const sessions: ExtraSession[] = [];
  for (const line of out.sessions) {
    const [d = "", t = "", m = "", n = "", ...l] = line.split("|").map((x) => x.trim());
    const date = parseDate(d);
    const time = parseTime(t);
    if (!date || !time) continue;
    sessions.push({ at: zonedTime(date, time, tz).toISOString(), m: Number(m) > 0 ? Math.min(24 * 60, Number(m)) : 60, n: n || undefined, l: l.join("|") || undefined });
  }
  return { sessions: sessions.sort((a, b) => a.at.localeCompare(b.at)), problem: out.problem };
}

/** Reads an activity's sessions from a link. Throws with a friendly message when it can't. */
export async function readActivitySource(
  rawUrl: string,
  tz: string,
  filter: string | null,
  activity: string,
): Promise<{ url: string; kind: "ics" | "web"; sessions: ExtraSession[] }> {
  const url = calendarLink(cleanLink(rawUrl));
  const first = await fetchText(url);
  if (first.includes("BEGIN:VCALENDAR")) {
    const sessions = sessionsFromIcs(first, tz, filter);
    if (!sessions.length) throw new Error(filter ? `No upcoming events matching “${filter}” in that calendar.` : "No upcoming events in that calendar.");
    return { url, kind: "ics", sessions };
  }
  const page = await readPage(url);
  const { sessions, problem } = await sessionsFromPage(page.text, page.url, tz, filter, activity);
  if (!sessions.length) throw new Error(problem ?? "No upcoming dates and times found on that page.");
  return { url, kind: "web", sessions };
}

const STALE_MS = { ics: 12 * 3600_000, web: 7 * 24 * 3600_000 };

/** Whether an imported activity is due a fresh read (calendars twice a day, web pages weekly). */
export function needsRefresh(a: Activity): boolean {
  if (!a.source_url || !a.source_kind) return false;
  return !a.synced_at || Date.now() - new Date(a.synced_at).getTime() > STALE_MS[a.source_kind];
}

/** Reads an imported activity's link again and replaces its sessions (keeps them if the read fails). */
export async function refreshActivity(a: Activity): Promise<Activity> {
  if (!a.source_url) return a;
  const synced_at = new Date().toISOString();
  try {
    const res = await readActivitySource(a.source_url, a.tz, a.source_filter, a.name);
    const next = { ...a, extra: res.sessions, source_kind: res.kind, synced_at, source_error: null };
    await saveActivity(next);
    return next;
  } catch (e) {
    const next = { ...a, synced_at, source_error: e instanceof Error ? e.message : "Couldn’t read the link." };
    await saveActivity(next);
    return next;
  }
}
