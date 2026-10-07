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
  feedUrl: string; // the link fixtures come from (may differ from what was pasted)
  feedType: FeedType;
  leagueName: string;
  shortName: string | null;
  venue: string | null;
  timezone: string | null;
  competitions: ScannedCompetition[]; // more than one: the user picks
  note: string | null;
};

const MAX_SCAN_CHARS = 300_000;

const Scanned = z.object({
  leagueName: z.string().describe("The league or competition organiser's name as shown, e.g. 'NBL' or 'Saturday Social League'"),
  shortName: z.string().nullable(),
  venue: z.string().nullable().describe("A single main venue if the league plays at one; otherwise null"),
  timezone: z.string().nullable().describe("IANA timezone where the games are played, e.g. 'Australia/Perth'; null if unclear"),
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

/** Links on a page that look like its fixtures/schedule page, best first. */
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
      if ((u.protocol === "https:" || u.protocol === "http:") && u.toString() !== pageUrl) found.push({ url: u.toString(), score });
    } catch {}
  }
  return [...new Map(found.sort((a, b) => b.score - a.score).map((f) => [f.url, f])).values()].slice(0, 3).map((f) => f.url);
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
- for each, roughly how many teams and games are listed.

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
    feedUrl: url,
    feedType,
    leagueName: hostName(url),
    shortName: null,
    venue: null,
    timezone: null,
    competitions: games.length ? [{ name: "Main", teams: new Set(games.flatMap((g) => [g.home, g.away])).size, games: games.length }] : [],
    note: games.length ? null : "No games found at that link.",
  });
  if (first.includes("BEGIN:VCALENDAR")) return simple("ics", fixturesFromIcs(first, null, "UTC").fixtures);
  if (!isHtml) return simple("csv", fixturesFromCsv(first, "UTC").fixtures);
  if (csvUrl !== url) throw new Error("That Google Sheet isn’t public yet. In the sheet: Share, then General access: Anyone with the link (Viewer).");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Reading web pages isn’t switched on yet.");

  // The page itself, then (if it has no games) its fixtures/schedule page.
  let page = await readPage(url);
  let scan = await aiScan(page.text, page.url);
  if (!scan.competitions.some((c) => c.games > 0)) {
    for (const link of fixtureLinks(page.html, page.url)) {
      const next = await readPage(link).catch(() => null);
      if (!next) continue;
      const nextScan = await aiScan(next.text, next.url);
      if (nextScan.competitions.some((c) => c.games > 0)) {
        // Keep the link that was pasted when it already led to the games (e.g. an embedding page).
        page = { ...next, url: link };
        scan = { ...nextScan, leagueName: nextScan.leagueName || scan.leagueName };
        break;
      }
    }
  }
  return {
    feedUrl: page.url,
    feedType: "web",
    leagueName: scan.leagueName || hostName(url),
    shortName: scan.shortName,
    venue: scan.venue,
    timezone: scan.timezone && isTimezone(scan.timezone) ? scan.timezone : null,
    competitions: scan.competitions.filter((c) => c.games > 0),
    note: scan.competitions.some((c) => c.games > 0) ? null : (scan.note ?? "No fixtures found at that link."),
  };
}
