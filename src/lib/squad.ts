import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { fetchText, htmlToText } from "./feeds";
import { readPage } from "./league-scan";
import type { Competition } from "./league";

// Finds a team's squad on its league's website, so a coach doesn't have to
// type the players in. Looks at the links on the fixtures page and the site's
// home page, picks the ones most likely to be this team's page or roster,
// and reads the player names from there (following a "Roster"/"Squad" link
// once if the team page itself doesn't list them).

export type SquadResult = { players: string[]; source: string | null; note: string | null };

const MAX_PAGE_CHARS = 150_000;
const MAX_LINKS = 400;
const MAX_TRIES = 3;

type Anchor = { url: string; label: string };

function anchors(html: string, pageUrl: string): Anchor[] {
  const out = new Map<string, Anchor>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const u = new URL(m[1].replace(/&(amp|#0*38|#x0*26);/gi, "&"), pageUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      const label = htmlToText(m[2]).replace(/\s+/g, " ").trim().slice(0, 80);
      const key = u.toString();
      if (!out.has(key) || (!out.get(key)!.label && label)) out.set(key, { url: key, label });
    } catch {}
  }
  return [...out.values()];
}

const linkList = (links: Anchor[]) => links.map((a) => `${a.label || "(no text)"} | ${a.url}`).join("\n");

const Picked = z.object({
  urls: z.array(z.string()).describe("Up to 3 URLs from the list, best first; empty if none fit"),
});

const Read = z.object({
  isThisTeam: z.boolean().describe("Whether the page is about this team (or lists its squad)"),
  players: z.array(z.string()).describe("This team's players only, each as 'First Last'. No coaches or staff."),
  rosterUrl: z
    .string()
    .nullable()
    .describe("If this team's players aren't listed here, the URL from the links that leads closest to them (the team's own page or club website, or a Roster/Squad/Players page); otherwise null"),
});

async function ask<T extends z.ZodType>(schema: T, prompt: string): Promise<z.infer<T> | null> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  return response.stop_reason === "refusal" ? null : (response.parsed_output ?? null);
}

/** "LeBron James" -> "LeBron J."; the app's convention for player names. */
export function shortName(full: string): string {
  const parts = full.replace(/\s+/g, " ").trim().split(" ");
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts[parts.length - 1].replace(/[^\p{L}]/gu, "");
  return last ? `${parts[0]} ${last[0].toUpperCase()}.` : parts[0];
}

async function readSquad(url: string, team: string, league: string) {
  const page = await readPage(url).catch(() => null);
  if (!page) return null;
  const links = anchors(page.html, page.url).slice(0, MAX_LINKS);
  const read = await ask(
    Read,
    `Below is a page from the website of ${league} (${page.url}). We want the players in the team "${team}".

If the page lists this team's players, return their names. If it doesn't, pick the link that leads closest to them: this team's page or club website, or its Roster/Squad/Players page.

<page>
${page.text.slice(0, MAX_PAGE_CHARS)}
</page>

<links>
${linkList(links)}
</links>`,
  );
  return read;
}

export async function findSquad(competition: Competition, team: string): Promise<SquadResult> {
  // The league's website (the link pasted when importing) and its fixtures page.
  const starts = [...new Set([competition.league.website, competition.feed_type === "web" ? competition.feed_url : null].filter((u): u is string => !!u))];
  const site = starts[0];
  if (!site) return { players: [], source: null, note: "This league has no website linked, so type the players in." };
  if (!process.env.ANTHROPIC_API_KEY) return { players: [], source: null, note: "Reading web pages isn’t switched on yet." };
  const league = competition.league.name;

  // Links from those pages and their sites' home pages.
  const origins = [...new Set(starts.map((u) => new URL(u).origin))].filter((o) => !starts.includes(o) && !starts.includes(`${o}/`));
  const pages = await Promise.all([
    ...starts.map((u) => readPage(u).catch(() => null)),
    ...origins.map((o) =>
      fetchText(o)
        .then((html) => ({ url: o, html }))
        .catch(() => null),
    ),
  ]);
  const links = [...new Map(pages.flatMap((p) => (p ? anchors(p.html, p.url) : [])).map((a) => [a.url, a])).values()];
  if (!links.length) return { players: [], source: null, note: "Couldn’t open the league website." };

  const picked = await ask(
    Picked,
    `These are links from the website of ${league}. Which are most likely to lead to the players (squad, roster) of the team "${team}" in "${competition.name}"? Prefer this team's own page, club website or roster page; a page listing all the teams is next best. Team names on websites may be shortened or use a code.

<links>
${linkList(links.slice(0, MAX_LINKS))}
</links>`,
  );
  const known = new Set(links.map((a) => a.url));
  const tries = (picked?.urls ?? []).filter((u) => known.has(u)).slice(0, MAX_TRIES);

  const deadline = Date.now() + 200_000; // stay inside the page's time limit
  for (const url of tries) {
    if (Date.now() > deadline) break;
    let read = await readSquad(url, team, league);
    let source = url;
    // Follow the trail a couple of steps: teams list, club website, its Players page.
    const seen = new Set([url]);
    for (let hop = 0; hop < 2 && read && read.players.length < 3 && read.rosterUrl && !seen.has(read.rosterUrl) && Date.now() < deadline; hop++) {
      source = read.rosterUrl;
      seen.add(source);
      read = await readSquad(source, team, league);
    }
    if (read?.isThisTeam && read.players.length >= 3) {
      // Two "Sam J."s keep their full names so they can be told apart.
      const full = [...new Set(read.players.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean))];
      const count = new Map<string, number>();
      for (const p of full) count.set(shortName(p), (count.get(shortName(p)) ?? 0) + 1);
      const players = full.map((p) => (count.get(shortName(p))! > 1 ? p : shortName(p)));
      return { players, source, note: null };
    }
  }
  return { players: [], source: null, note: "Couldn’t find a squad list for this team on the league website." };
}
