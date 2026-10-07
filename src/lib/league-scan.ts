import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fixturesFromCsv } from "./fixtures";
import {
  canRenderPages,
  embeddedPlatformUrl,
  fetchText,
  fixturesFromIcs,
  htmlToText,
  isPlatform,
  renderPage,
  sheetCsvUrl,
  type FeedType,
} from "./feeds";
import { isTimezone } from "./time";

// "Got a league website? Let's see what we can pull." Reads a link (web page,
// Google Sheet, CSV or calendar) and works out the league, its timezone and
// the competitions on it, so a new league can be set up in one go. If the
// link is a home page, it follows the site's fixtures/schedule link.

export type ScannedCompetition = { name: string; teams: number; games: number };
export type LeagueScan = {
  siteUrl: string; // the link that was pasted (the league's website)
  feedUrl: string; // the link fixtures come from (may differ from what was pasted)
  feedType: FeedType;
  leagueName: string;
  shortName: string | null;
  venue: string | null;
  timezone: string | null;
  ladderStyle: "points" | "wins"; // "wins" for sports ranked by wins and losses (basketball)
  ladderUrl: string | null; // the league's own ladder/standings page, if it has one
  competitions: ScannedCompetition[]; // more than one: the user picks
  note: string | null;
};

const MAX_SCAN_CHARS = 300_000;

const Scanned = z.object({
  leagueName: z.string().describe("The league or competition organiser's name as shown, e.g. 'NBL' or 'Saturday Social League'"),
  shortName: z.string().nullable(),
  venue: z.string().nullable().describe("A single main venue if the league plays at one; otherwise null"),
  timezone: z.string().nullable().describe("IANA timezone where the games are played, e.g. 'Australia/Perth'; null if unclear"),
  rankedByWins: z
    .boolean()
    .describe("True if the sport ranks teams by wins and losses with no draws (basketball, baseball); false for points ladders (football, rugby, hockey, netball)"),
  competitions: z
    .array(
      z.object({
        name: z.string().describe("Exactly as written on the page, e.g. 'Under 10s', 'Premier League', 'New Balance NPL M Group B'"),
        teams: z.number().int(),
        games: z.number().int(),
      }),
    )
    .describe("Separate draws on the page: age groups, grades, divisions, men/women. Not stages of one season."),
  note: z.string().nullable().describe("If no fixtures are on this page, a short reason; otherwise null"),
});

export type PageRead = { url: string; html: string; text: string };

/** A page's text as a browser shows it (embedded fixtures followed, JavaScript run). */
export async function readPage(url: string): Promise<PageRead> {
  const html = await fetchText(url);
  const embedded = embeddedPlatformUrl(html, url);
  let text = htmlToText(html);
  if (canRenderPages() && (embedded || isPlatform(url) || text.length < 400)) {
    const rendered = await renderPage(embedded ?? url);
    return { url: embedded ?? url, html: rendered, text: htmlToText(rendered) };
  }
  if (embedded) {
    const inner = await fetchText(embedded);
    text = htmlToText(inner);
    return { url: embedded, html: inner, text };
  }
  return { url, html, text };
}

/** "www.nbl.com.au" and "schedule.nbl.com.au" → "nbl.com.au": the site a link belongs to. */
export function siteOf(url: string): string {
  const parts = new URL(url).hostname.toLowerCase().replace(/^www\./, "").split(".");
  const second = parts[parts.length - 2] ?? "";
  const keep = parts.length > 2 && parts[parts.length - 1].length === 2 && /^(com|net|org|edu|gov|asn|id|co|ac)$/.test(second) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

/** Links on a page that look like its fixtures/schedule page, best first. Only on the same
 *  site (or its subdomains): ads and streaming links ("Watch on Kayo") don't count. */
function fixtureLinks(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const found: { url: string; score: number }[] = [];
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlToText(m[2]).toLowerCase();
    const href = m[1].replace(/&(amp|#0*38|#x0*26);/gi, "&");
    const hay = `${href.toLowerCase()} ${label}`;
    const score = /fixture|schedule|draw/.test(hay) ? 2 : /result|matches|games|matchday/.test(hay) ? 1 : 0;
    if (!score) continue;
    try {
      const u = new URL(href, base);
      const ok = (u.protocol === "https:" || u.protocol === "http:") && u.toString() !== pageUrl && siteOf(u.toString()) === siteOf(pageUrl);
      if (ok) found.push({ url: u.toString(), score });
    } catch {}
  }
  return [...new Map(found.sort((a, b) => b.score - a.score).map((f) => [f.url, f])).values()].slice(0, 3).map((f) => f.url);
}

/** The site's ladder/standings page, if it links to one. */
function ladderLink(html: string, pageUrl: string): string | null {
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&(amp|#0*38|#x0*26);/gi, "&");
    if (!/ladder|standings|table/i.test(`${href} ${htmlToText(m[2])}`) || /cup|odds|bet/i.test(href)) continue;
    try {
      const u = new URL(href, pageUrl);
      if ((u.protocol === "https:" || u.protocol === "http:") && siteOf(u.toString()) === siteOf(pageUrl)) return u.toString();
    } catch {}
  }
  return null;
}

async function aiScan(text: string, url: string) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Scanned) },
    messages: [
      {
        role: "user",
        content: `Below is the text of a sports web page (${url}). Someone wants to set up this league in a team app and import its fixtures.

Work out:
- the league's name (and a short name if there is one), its main venue if it plays at a single venue, and the IANA timezone where games are played;
- the separate competitions this page has fixtures or results for (age groups, grades, divisions, men's/women's). Stages of one season (preseason, rounds, finals, cups within the season) are NOT separate competitions. If there's just one, return one with a short name (e.g. "Men" or the division's name). Use names exactly as written on the page;
- for each, roughly how many teams and games are listed (all of them: played and upcoming);
- whether the sport ranks teams by wins and losses (basketball, baseball) rather than a points ladder.

If the page lists no fixtures or results at all, return no competitions and explain in "note".

<page>
${text.slice(0, MAX_SCAN_CHARS)}
</page>`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("The page couldn’t be read.");
  return response.parsed_output;
}

const hostName = (url: string) => new URL(url).hostname.replace(/^www\./, "");

export async function scanLeague(rawUrl: string): Promise<LeagueScan> {
  const url = /^[a-z]+:\/\//i.test(rawUrl.trim()) ? rawUrl.trim().replace(/^webcal:/i, "https:") : `https://${rawUrl.trim()}`;
  // Spreadsheets and calendars: one competition, everything in it.
  const csvUrl = sheetCsvUrl(url);
  const first = await fetchText(csvUrl);
  const isHtml = /^\s*(<!doctype html|<html)/i.test(first.slice(0, 5000)) || /<(head|body|div|table)[\s>]/i.test(first.slice(0, 5000));
  const simple = (feedType: FeedType, games: { home: string; away: string }[]): LeagueScan => ({
    siteUrl: url,
    feedUrl: url,
    feedType,
    leagueName: hostName(url),
    shortName: null,
    venue: null,
    timezone: null,
    ladderStyle: "points",
    ladderUrl: null,
    competitions: games.length ? [{ name: "Main", teams: new Set(games.flatMap((g) => [g.home, g.away])).size, games: games.length }] : [],
    note: games.length ? null : "No games found at that link.",
  });
  if (first.includes("BEGIN:VCALENDAR")) return simple("ics", fixturesFromIcs(first, null, "UTC").fixtures);
  if (!isHtml) return simple("csv", fixturesFromCsv(first, "UTC").fixtures);
  if (csvUrl !== url) throw new Error("That Google Sheet isn’t public yet. In the sheet: Share, then General access: Anyone with the link (Viewer).");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Reading web pages isn’t switched on yet.");

  // The page itself, then its fixtures/schedule page: a home page often shows
  // only the next few games, while the schedule has the whole season and its
  // results. Whichever lists the most games wins.
  let page = await readPage(url);
  let scan = await aiScan(page.text, page.url);
  const home = page;
  const total = (s: typeof scan) => s.competitions.reduce((n, c) => n + c.games, 0);
  for (const link of fixtureLinks(page.html, page.url).slice(0, total(scan) ? 1 : 3)) {
    const next = await readPage(link).catch(() => null);
    if (!next) continue;
    const nextScan = await aiScan(next.text, next.url).catch(() => null);
    if (nextScan && total(nextScan) > total(scan)) {
      page = { ...next, url: link };
      scan = { ...nextScan, leagueName: scan.leagueName || nextScan.leagueName };
      break;
    }
  }
  return {
    siteUrl: url,
    feedUrl: page.url,
    feedType: "web",
    leagueName: scan.leagueName || hostName(url),
    shortName: scan.shortName,
    venue: scan.venue,
    timezone: scan.timezone && isTimezone(scan.timezone) ? scan.timezone : null,
    ladderStyle: scan.rankedByWins ? "wins" : "points",
    ladderUrl: ladderLink(home.html, home.url) ?? (page === home ? null : ladderLink(page.html, page.url)),
    competitions: scan.competitions.filter((c) => c.games > 0),
    note: scan.competitions.some((c) => c.games > 0) ? null : (scan.note ?? "No fixtures found at that link."),
  };
}
