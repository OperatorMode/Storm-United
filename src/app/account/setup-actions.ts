"use server";

import { competitionLabel, competitionTeams, listCompetitions } from "@/lib/league";
import { listTeams } from "@/lib/store";
import { currentManagerId } from "@/lib/session";
import { searchLeagueOnline, type LeagueCandidate } from "@/lib/league-search";
import { lockedMessage, recordFailure } from "@/lib/rate-limit";

// The steps of "Set up your team" that look things up: your team in the
// leagues already on Sidelnr, your league by name, or (no link) a web search
// for where the league publishes its fixtures.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type TeamHit = { competitionId: string; label: string; team: string; taken: boolean };

/** Step 1: your team, in the draws Sidelnr already has. */
export async function findTeamAction(query: string): Promise<{ hits: TeamHit[] }> {
  if (!(await currentManagerId())) return { hits: [] };
  const q = norm(query);
  if (q.length < 2) return { hits: [] };
  const words = q.split(" ");
  const [competitions, sidelnr] = await Promise.all([listCompetitions(), listTeams()]);
  // Draws often list just "Rockets": match the team's name together with its league's ("Riverside Rockets").
  const hits: (TeamHit & { exact: boolean })[] = [];
  for (const c of competitions.filter((x) => x.kind !== "tournament")) {
    const league = norm([c.league.name, c.league.short_name, c.name].filter(Boolean).join(" "));
    for (const team of await competitionTeams(c.id).catch(() => [] as string[])) {
      const t = norm(team);
      if (!words.every((w) => t.includes(w) || league.includes(w))) continue;
      hits.push({
        competitionId: c.id,
        label: competitionLabel(c),
        team,
        taken: sidelnr.some((s) => s.competition_id === c.id && s.league_name === team),
        exact: words.some((w) => t.includes(w)),
      });
    }
  }
  return { hits: hits.sort((a, b) => Number(b.exact) - Number(a.exact)).slice(0, 12).map(({ exact: _e, ...h }) => h) }; // eslint-disable-line @typescript-eslint/no-unused-vars
}

export type LeagueHit = { competitionId: string; label: string; detail: string };

/** Step 2: your league (and competition), by name. */
export async function findLeagueAction(query: string): Promise<{ hits: LeagueHit[] }> {
  if (!(await currentManagerId())) return { hits: [] };
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return { hits: [] };
  const competitions = (await listCompetitions()).filter((c) => c.kind !== "tournament");
  const hits = competitions
    .filter((c) => {
      const hay = norm([c.league.name, c.league.short_name, c.name, c.league.venue].filter(Boolean).join(" "));
      return words.every((w) => hay.includes(w));
    })
    .slice(0, 15)
    .map((c) => ({ competitionId: c.id, label: competitionLabel(c), detail: [c.season, c.league.venue].filter(Boolean).join(" · ") }));
  return { hits };
}

/** Step 4 (no link): search the web for where the league publishes its fixtures. A few searches per person at a time. */
export async function searchOnlineAction(name: string, area: string): Promise<{ candidates?: LeagueCandidate[]; error?: string }> {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const league = name.replace(/\s+/g, " ").trim().slice(0, 100);
  if (league.length < 3) return { error: "Type the league’s name." };
  const locked = await lockedMessage("search", managerId);
  if (locked) return { error: "That’s a lot of searches. Try again in a few minutes." };
  await recordFailure("search", managerId); // counts searches: 5 in 15 minutes
  try {
    return { candidates: await searchLeagueOnline(league, area.replace(/\s+/g, " ").trim().slice(0, 100)) };
  } catch (e) {
    console.error("league search", e);
    return { error: "Couldn’t search just now. Try again in a moment." };
  }
}

/** A competition's name, for the team step after importing it. */
export async function competitionLabelAction(competitionId: string): Promise<string> {
  if (!(await currentManagerId())) return "";
  const c = (await listCompetitions()).find((x) => x.id === competitionId);
  return c ? competitionLabel(c) : "";
}
