"use server";

import { competitionLabel, competitionTeams, getCompetition, listCompetitions } from "@/lib/league";
import { findSquad, type SquadResult } from "@/lib/squad";
import { listTeams } from "@/lib/store";
import { currentManagerId, isSuperAdmin } from "@/lib/session";

// Finding a competition by typing (there can be thousands across all sports).

export type CompetitionHit = { id: string; label: string; detail: string };

// "Under 10s" also matches "u10", and "U10" matches "under 10".
const AGE = /\bunder\s*-?\s*(\d+)s?\b|\bu\s*-?\s*(\d+)s?\b/g;

/** Up to 15 competitions matching every word typed (league, competition, season, venue). */
export async function searchCompetitions(query: string): Promise<CompetitionHit[]> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length || query.length > 80) return [];
  const all = await listCompetitions();
  return all
    .map((c) => {
      const raw = [c.name, c.season, c.league.name, c.league.short_name, c.league.venue].filter(Boolean).join(" ").toLowerCase();
      const text = raw.replace(AGE, (m, a, b) => `${m} u${a ?? b} under ${a ?? b}`);
      return { c, text };
    })
    .filter(({ text }) => words.every((w) => text.includes(w)))
    .sort((a, b) => a.c.league.name.localeCompare(b.c.league.name) || a.c.name.localeCompare(b.c.name))
    .slice(0, 15)
    .map(({ c }) => ({
      id: c.id,
      label: competitionLabel(c),
      detail: [c.kind === "tournament" ? "Event" : c.season, c.league.venue].filter(Boolean).join(" · "),
    }));
}

/**
 * The teams in a competition's draw, and which already have a Sidelnr team
 * (team name -> Sidelnr team). For managers and the owner only.
 */
export async function drawTeams(competitionId: string, editingId: string | null): Promise<{ teams: string[]; taken: Record<string, string> }> {
  if (!(await currentManagerId()) && !(await isSuperAdmin())) return { teams: [], taken: {} };
  const [teams, sidelnr] = await Promise.all([competitionTeams(competitionId), listTeams()]);
  const taken = Object.fromEntries(
    sidelnr.filter((t) => t.id !== editingId && t.competition_id === competitionId).map((t) => [t.league_name, t.name]),
  );
  return { teams: [...teams].sort(), taken };
}

/** A team's players from its league's website (for the team form). */
export async function findSquadAction(competitionId: string, team: string): Promise<SquadResult> {
  if (!(await currentManagerId()) && !(await isSuperAdmin())) return { players: [], source: null, note: "Sign in first." };
  const competition = await getCompetition(competitionId);
  if (!competition || !(await competitionTeams(competitionId)).includes(team)) return { players: [], source: null, note: null };
  try {
    return await findSquad(competition, team);
  } catch (e) {
    console.error("findSquad", e);
    return { players: [], source: null, note: "Couldn’t read the league website just now." };
  }
}
