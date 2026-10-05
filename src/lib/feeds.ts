import { after } from "next/server";
import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  addCompetitionTeams,
  fixturesFromCsv,
  listFixtures,
  mergeImported,
  parseDate,
  parseTime,
  saveFixtures,
  upsertCompetition,
  zonedTime,
  type ImportedFixture,
} from "./fixtures";
import { check, db, listLeagues, readLocal, writeLocal, type CompetitionRow } from "./store";
import { DEFAULT_TZ } from "./time";

// Fixtures from a link, synced into the fixtures table:
//  - csv: a CSV link or a Google Sheet (same columns as the upload template)
//  - ics: a calendar link (one team's games)
//  - web: any web page, read by Claude
// Syncs run in the background when a team page is viewed and the data is
// stale, or on demand ("Sync now").

export type FeedType = "csv" | "ics" | "web";
const STALE_MS: Record<FeedType, number> = { csv: 10 * 60_000, ics: 10 * 60_000, web: 60 * 60_000 };
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_PAGE_CHARS = 150_000;

// ---------- safe fetching (users type these URLs) ----------

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::" || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn’t look like a web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("The link must start with https://");
  if (url.username || url.password) throw new Error("Links with passwords aren’t supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn’t public.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new Error("We couldn’t find that website.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn’t public.");
  return url;
}

export async function fetchText(raw: string): Promise<string> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "SidelnrBot/1.0 (+https://sidelnr.app)", Accept: "text/html,text/csv,text/calendar,*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The link returned an error (${res.status}).`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("That file is too big.");
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("That file is too big.");
    return text;
  }
  throw new Error("Too many redirects.");
}

// A normal Google Sheets link -> its CSV export (sheet must be shared/published).
export function sheetCsvUrl(raw: string): string {
  const m = raw.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!m || raw.includes("output=csv") || raw.includes("format=csv")) return raw;
  const gid = raw.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}

// ---------- calendars (ICS) ----------

function icsDate(value: string, params: string, fallbackTz: string): Date | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", , z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  const tz = params.match(/TZID=([^;:]+)/)?.[1];
  return zonedTime(`${y}-${mo}-${d}`, `${h}:${mi}`, tz ?? fallbackTz);
}

export function fixturesFromIcs(text: string, ourTeam: string | null, tz: string): { fixtures: ImportedFixture[]; errors: string[] } {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/); // unfold
  const fixtures: ImportedFixture[] = [];
  const errors: string[] = [];
  let ev: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT" && ev) {
      const summary = (ev.SUMMARY?.value ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
      const start = ev.DTSTART ? icsDate(ev.DTSTART.value, ev.DTSTART.params, tz) : null;
      if (ev.STATUS?.value === "CANCELLED" || !start || !summary) {
        ev = null;
        continue;
      }
      // "Round 4 - Sharks vs Tigers" -> "Sharks vs Tigers"; prefer vs/v/@ over a dash as the separator.
      const title = summary.replace(/^\s*(?:round|rd|week)\s*\d+\s*[-:–|]\s*/i, "");
      let parts = title.split(/\s+(?:vs\.?|v\.?|versus|@)\s+/i).map((s) => s.trim());
      if (parts.length !== 2) parts = title.split(/\s+[-–]\s+/).map((s) => s.trim());
      // A generic side ("Game vs Lions") means the calendar's own team.
      const generic = /^(game|match|fixture|us|we)$/i;
      if (parts.length === 2 && ourTeam) parts = parts.map((p) => (generic.test(p) ? ourTeam : p));
      let home: string | null = null;
      let away: string | null = null;
      if (parts.length === 2 && !parts.some((p) => generic.test(p))) [home, away] = parts;
      else if (ourTeam && parts.length === 1) [home, away] = [ourTeam, title.replace(/^(game|match)\s*(vs\.?|v\.?|against)?\s*/i, "")];
      if (!home || !away || home === away) errors.push(`Skipped “${summary}” (couldn’t tell the two teams apart).`);
      else
        fixtures.push({
          round: Number(summary.match(/\b(?:round|rd)\s*(\d+)/i)?.[1]) || null,
          stage: null,
          kickoff: start.toISOString(),
          pitch: (ev.LOCATION?.value ?? "").replace(/\\,/g, ",").trim() || null,
          home: home.replace(/\s*\((home|away)\)$/i, ""),
          away: away.replace(/\s*\((home|away)\)$/i, ""),
          home_score: null,
          away_score: null,
        });
      ev = null;
    } else if (ev) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
      if (m) ev[m[1]] = { params: m[2], value: m[3] };
    }
  }
  return { fixtures, errors };
}

// ---------- any web page, read by Claude ----------

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d|\/table|\/section)[^>]*>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const Extracted = z.object({
  fixtures: z.array(
    z.object({
      round: z.number().int().nullable(),
      stage: z.string().nullable(),
      date: z.string().describe("YYYY-MM-DD"),
      time: z.string().nullable().describe("Local kick-off time, 24-hour HH:MM; null if not shown"),
      pitch: z.string().nullable(),
      home: z.string(),
      away: z.string(),
      home_score: z.number().int().nullable(),
      away_score: z.number().int().nullable(),
    }),
  ),
  problem: z.string().nullable().describe("If the fixtures couldn't be found, a short reason; otherwise null"),
});

async function fixturesFromWebPage(pageText: string, url: string, filter: string | null, tz: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Website reading isn’t set up yet (no ANTHROPIC_API_KEY).");
  if (pageText.length < 40) {
    throw new Error("That page has no readable fixtures — it may load them with JavaScript. Try its CSV or calendar export instead.");
  }
  if (pageText.length > MAX_PAGE_CHARS) throw new Error("That page is too large to read — link to the specific competition’s page.");
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Extracted) },
    messages: [
      {
        role: "user",
        content: `Below is the text of a sports league web page (${url}). Extract every game (fixture or result) ${
          filter ? `for this competition/division only: "${filter}"` : "on the page"
        }.

Rules:
- Team names exactly as written on the page.
- Dates as YYYY-MM-DD. If the year isn't shown, use the season that fits around today (${today}).
- Times as local 24-hour HH:MM, or null if not shown.
- Scores only for games that have been played; otherwise null.
- Don't invent games. If there are no fixtures for that competition, return an empty list and explain in "problem".

<page>
${pageText}
</page>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The page couldn’t be read.");
  const out = response.parsed_output;
  if (!out) throw new Error("The page couldn’t be read.");
  const fixtures: ImportedFixture[] = [];
  const errors: string[] = out.problem ? [out.problem] : [];
  for (const f of out.fixtures) {
    const date = parseDate(f.date);
    const time = f.time ? parseTime(f.time) : "12:00";
    if (!date || !time || !f.home.trim() || !f.away.trim() || f.home === f.away) {
      errors.push(`Skipped ${f.home} v ${f.away} (${f.date}).`);
      continue;
    }
    fixtures.push({
      round: f.round,
      stage: f.stage,
      kickoff: zonedTime(date, time, tz).toISOString(),
      pitch: f.pitch,
      home: f.home.trim(),
      away: f.away.trim(),
      home_score: f.home_score,
      away_score: f.away_score,
    });
  }
  return { fixtures, errors };
}

// ---------- reading a feed ----------

export type FeedSettings = { type: FeedType; url: string; filter: string | null; team: string | null };

// Fetches and parses a feed. For web pages, `previousHash` lets an unchanged
// page skip the (paid) AI read: returns `unchanged: true`.
export async function readFeed(
  feed: FeedSettings,
  tz: string,
  previousHash: string | null = null,
): Promise<{ fixtures: ImportedFixture[]; errors: string[]; hash: string | null; unchanged?: boolean }> {
  if (feed.type === "csv") {
    const text = await fetchText(sheetCsvUrl(feed.url));
    if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
      throw new Error("That link opens a web page, not a CSV. For Google Sheets: Share → Anyone with the link can view.");
    }
    return { ...fixturesFromCsv(text, tz), hash: null };
  }
  if (feed.type === "ics") {
    const text = await fetchText(feed.url.replace(/^webcal:/i, "https:"));
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn’t a calendar (ICS) file.");
    return { ...fixturesFromIcs(text, feed.team, tz), hash: null };
  }
  const pageText = htmlToText(await fetchText(feed.url));
  const hash = createHash("sha256").update(`${feed.filter ?? ""}|${pageText}`).digest("hex");
  if (previousHash && hash === previousHash) return { fixtures: [], errors: [], hash, unchanged: true };
  return { ...(await fixturesFromWebPage(pageText, feed.url, feed.filter, tz)), hash };
}

// ---------- syncing into a competition ----------

async function competitionRow(id: string): Promise<CompetitionRow | null> {
  const s = db();
  if (!s) return ((await readLocal()).competitions ?? []).find((c) => c.id === id) ?? null;
  return check(await s.from("competitions").select("*").eq("id", id).maybeSingle()) as CompetitionRow | null;
}

async function markSynced(id: string, patch: Partial<CompetitionRow>) {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.competitions = (d.competitions ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    return writeLocal(d);
  }
  check(await s.from("competitions").update(patch).eq("id", id));
}

export async function syncCompetitionFeed(competitionId: string, force = false): Promise<{ count: number; errors: string[] }> {
  const c = await competitionRow(competitionId);
  if (!c?.feed_type || !c.feed_url) return { count: 0, errors: [] };
  const now = new Date().toISOString();
  try {
    const feed = { type: c.feed_type, url: c.feed_url, filter: c.feed_filter ?? null, team: c.feed_team ?? null };
    const tz = (await listLeagues()).find((l) => l.id === c.league_id)?.timezone || DEFAULT_TZ;
    const res = await readFeed(feed, tz, force ? null : (c.feed_hash ?? null));
    if (res.unchanged) {
      await markSynced(competitionId, { feed_synced_at: now, feed_error: null });
      return { count: 0, errors: [] };
    }
    if (!res.fixtures.length) throw new Error(res.errors[0] ?? "No fixtures found at that link.");
    const merged = mergeImported(competitionId, await listFixtures(competitionId), res.fixtures);
    await saveFixtures(merged);
    await addCompetitionTeams(competitionId, res.fixtures.flatMap((f) => [f.home, f.away]));
    await markSynced(competitionId, { feed_synced_at: now, feed_error: null, feed_hash: res.hash });
    return { count: merged.length, errors: res.errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    await markSynced(competitionId, { feed_synced_at: now, feed_error: message });
    return { count: 0, errors: [message] };
  }
}

// Called while rendering team pages: refresh a stale feed in the background.
export function syncIfStale(c: Pick<CompetitionRow, "id" | "feed_type" | "feed_url" | "feed_synced_at">) {
  if (!c.feed_type || !c.feed_url) return;
  const age = c.feed_synced_at ? Date.now() - new Date(c.feed_synced_at).getTime() : Infinity;
  if (age < STALE_MS[c.feed_type]) return;
  try {
    after(() => syncCompetitionFeed(c.id).then(() => undefined));
  } catch {
    // Outside a request (e.g. build time) there's nothing to schedule on.
  }
}

export async function saveFeedSettings(competition: CompetitionRow, feed: FeedSettings | null) {
  await upsertCompetition({
    ...competition,
    feed_type: feed?.type ?? null,
    feed_url: feed?.url ?? null,
    feed_filter: feed?.filter ?? null,
    feed_team: feed?.team ?? null,
    feed_hash: null,
    feed_error: null,
    feed_synced_at: null,
  });
}
