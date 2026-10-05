import { cache } from "react";
import { getManualScores, listCompetitionRows, listLeagues, type CompetitionRow, type LeagueRow } from "./store";
import { now as clockNow } from "./clock";
import { loadTpp } from "./sources/tpp";
import type { SourceData } from "./sources/types";

// League → Competition → fixtures. A team belongs to one competition; the
// competition's league says where fixtures and results come from (its
// "source"). Every source returns the same shape (see sources/types.ts), so
// the rest of the app doesn't care whether it's TPP's feed or an upload.

export type Competition = CompetitionRow & { league: LeagueRow };

export const listCompetitions = cache(async (): Promise<Competition[]> => {
  const [comps, leagues] = await Promise.all([listCompetitionRows(), listLeagues()]);
  return comps.flatMap((c) => {
    const league = leagues.find((l) => l.id === c.league_id);
    return league ? [{ ...c, league }] : [];
  });
});

export async function getCompetition(id: string): Promise<Competition | null> {
  return (await listCompetitions()).find((c) => c.id === id) ?? null;
}

// Teams created before competitions existed only have a TPP division.
function competitionIdFor(team: { competition_id: string | null; division: string }): string {
  return team.competition_id ?? `tpp-2026-${team.division.toLowerCase()}`;
}

export function competitionLabel(c: Competition): string {
  return `${c.name} · ${c.league.short_name ?? c.league.name}`;
}

const loadSource = cache(async (competitionId: string): Promise<SourceData> => {
  const c = await getCompetition(competitionId);
  if (!c) return { teams: [], games: [], byes: [] };
  switch (c.league.source) {
    case "tpp":
      return loadTpp(c.source_key ?? "");
    default:
      return { teams: [], games: [], byes: [] }; // manual / uploaded fixtures: coming in phase 3
  }
});

// Every team in a competition, as named in its fixtures (for setting up teams).
export async function competitionTeams(competitionId: string): Promise<string[]> {
  return [...(await loadSource(competitionId)).teams].sort();
}

export type Game = {
  id: string;
  round: number | null;
  time: string; // "5:45 pm"
  pitch: string | null;
  home: string;
  away: string;
  kickoff: Date;
  score: { home: number; away: number } | null;
  scoreSource: "league" | "manual" | null;
};

export type LadderRow = {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

export type LeagueData = {
  competition: Competition | null;
  ourGames: Game[];
  byeRounds: { round: number; date: Date | null }[];
  ladder: LadderRow[];
};

// `team.league_name` is the team as named in its competition's fixtures.
export async function getLeagueData(team: {
  id: string;
  league_name: string;
  competition_id: string | null;
  division: string;
}): Promise<LeagueData> {
  const us = team.league_name;
  const competitionId = competitionIdFor(team);
  const [competition, source, manual] = await Promise.all([
    getCompetition(competitionId),
    loadSource(competitionId),
    getManualScores(team.id),
  ]);

  const games: Game[] = source.games
    .map((g): Game => {
      const own = manual[g.id];
      return {
        id: g.id,
        round: g.round,
        time: g.timeLabel,
        pitch: g.pitch,
        home: g.home,
        away: g.away,
        kickoff: g.kickoff,
        // The source's score wins; a team's manual score is only a fallback while it's missing.
        score: g.score ?? own ?? null,
        scoreSource: g.score ? "league" : own ? "manual" : null,
      };
    })
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  return {
    competition,
    ourGames: games.filter((g) => g.home === us || g.away === us),
    byeRounds: source.byes.filter((b) => b.team === us).map(({ round, date }) => ({ round, date })),
    ladder: buildLadder(source.teams, games, {
      win: competition?.points_win ?? 3,
      draw: competition?.points_draw ?? 1,
      lastRound: competition?.ladder_last_round ?? null,
    }),
  };
}

function buildLadder(
  teams: string[],
  games: Game[],
  rules: { win: number; draw: number; lastRound: number | null },
): LadderRow[] {
  const rows = new Map<string, LadderRow>(
    teams.map((t) => [t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]),
  );
  for (const g of games) {
    if (!g.score) continue;
    if (rules.lastRound !== null && g.round !== null && g.round > rules.lastRound) continue; // finals
    const h = rows.get(g.home);
    const a = rows.get(g.away);
    if (!h || !a) continue;
    const { home, away } = g.score;
    h.p++; a.p++;
    h.gf += home; h.ga += away;
    a.gf += away; a.ga += home;
    if (home > away) { h.w++; a.l++; h.pts += rules.win; }
    else if (home < away) { a.w++; h.l++; a.pts += rules.win; }
    else { h.d++; a.d++; h.pts += rules.draw; a.pts += rules.draw; }
  }
  // Tie-breakers: points, goal difference, goals scored.
  return [...rows.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team));
}

export function opponent(g: Game, us: string): string {
  return g.home === us ? g.away : g.home;
}

export function ourScore(g: Game, us: string): { us: number; them: number } | null {
  if (!g.score) return null;
  return g.home === us
    ? { us: g.score.home, them: g.score.away }
    : { us: g.score.away, them: g.score.home };
}

// A game counts as "next" until ~1.5h after kick-off (36 min of play + buffer).
const GAME_WINDOW_MS = 90 * 60 * 1000;
export function nextGame(games: Game[], now = clockNow()): Game | null {
  return games.find((g) => g.kickoff.getTime() + GAME_WINDOW_MS > now.getTime()) ?? null;
}

// MVP voting opens at kick-off and closes 48h later (Wednesday evening).
export const VOTING_WINDOW_MS = 48 * 60 * 60 * 1000;
export function votingState(g: Game, now = clockNow()): "upcoming" | "open" | "closed" {
  const t = now.getTime();
  const k = g.kickoff.getTime();
  if (t < k) return "upcoming";
  if (t < k + VOTING_WINDOW_MS) return "open";
  return "closed";
}

const DAY = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  weekday: "short",
  day: "numeric",
  month: "short",
});
export function formatDay(d: Date): string {
  return DAY.format(d);
}

// A yyyy-mm-dd date (e.g. a competition's finals date) as "Mon, 14 Dec".
export function formatIsoDate(iso: string): string {
  return formatDay(new Date(`${iso}T12:00:00+08:00`));
}

// Teams meet a set number of minutes before kick-off (warm-up / practice).
const TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
export function meetingTime(g: Game, minutesBefore: number): string {
  return TIME.format(new Date(g.kickoff.getTime() - minutesBefore * 60 * 1000)).replace(/\s*([ap])\.?m\.?/i, " $1m").toLowerCase();
}
