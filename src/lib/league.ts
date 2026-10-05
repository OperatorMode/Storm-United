import { getManualScores } from "./store";
import { now as clockNow } from "./clock";

// Everything here comes from the league's own site (tpp-6aside.netlify.app):
// the draw lives in a static data.js file, results in a public Firebase feed
// keyed by game id ({ h, a }) that the league updates on the night.
const DRAW_URL = "https://tpp-6aside.netlify.app/data.js";
const RESULTS_URL =
  "https://tpp-mindset-default-rtdb.asia-southeast1.firebasedatabase.app/sixaside2026/public.json";

export const TEAM = "Storm United";
export const DIVISION = "U10";
export const FINALS_DATE = "14/12/2026";
// Ladder only counts the regular season — week 10 is finals/placings.
const LAST_REGULAR_ROUND = 9;

export type Game = {
  id: string;
  round: number;
  date: string; // dd/mm/yyyy
  time: string; // "5:45 pm"
  pitch: number;
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

type RawGame = Omit<Game, "kickoff" | "score" | "scoreSource"> & { div: string };
type RawLeague = {
  teams: Record<string, { name: string }[]>;
  games: RawGame[];
  byes: { round: number; div: string; team: string }[];
  dates: { round: number; date: string }[];
};

// Perth is UTC+8 all year (no daylight saving).
export function perthKickoff(date: string, time: string): Date {
  const [d, m, y] = date.split("/").map(Number);
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  let h = match ? Number(match[1]) % 12 : 0;
  const min = match ? Number(match[2]) : 0;
  if (match && match[3].toLowerCase() === "pm") h += 12;
  return new Date(Date.UTC(y, m - 1, d, h - 8, min));
}

async function fetchDraw(): Promise<RawLeague> {
  const res = await fetch(DRAW_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Draw fetch failed: ${res.status}`);
  const text = await res.text();
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json) as RawLeague;
}

async function fetchResults(): Promise<Record<string, { h: number; a: number }>> {
  try {
    const res = await fetch(RESULTS_URL, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    return (await res.json()) ?? {};
  } catch {
    return {};
  }
}

export type LeagueData = {
  ourGames: Game[];
  byeRounds: { round: number; date: string }[];
  ladder: LadderRow[];
};

export async function getLeagueData(): Promise<LeagueData> {
  const [draw, results, manual] = await Promise.all([
    fetchDraw(),
    fetchResults(),
    getManualScores(),
  ]);

  const divGames: Game[] = draw.games
    .filter((g) => g.div === DIVISION)
    .map((g): Game => {
      const league = results[g.id];
      const own = manual[g.id];
      const leagueScore =
        league && Number.isFinite(Number(league.h)) && Number.isFinite(Number(league.a))
          ? { home: Number(league.h), away: Number(league.a) }
          : null;
      return {
        id: g.id,
        round: g.round,
        date: g.date,
        time: g.time,
        pitch: g.pitch,
        home: g.home,
        away: g.away,
        kickoff: perthKickoff(g.date, g.time),
        // League feed wins; a manual score is only a fallback while it's missing.
        score: leagueScore ?? own ?? null,
        scoreSource: leagueScore ? "league" : own ? "manual" : null,
      };
    })
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  const ourGames = divGames.filter((g) => g.home === TEAM || g.away === TEAM);
  const dateOf = new Map(draw.dates.map((d) => [d.round, d.date]));
  const byeRounds = draw.byes
    .filter((b) => b.div === DIVISION && b.team === TEAM)
    .map((b) => ({ round: b.round, date: dateOf.get(b.round) ?? "" }));

  const teams = (draw.teams[DIVISION] ?? []).map((t) => t.name);
  return { ourGames, byeRounds, ladder: buildLadder(teams, divGames) };
}

function buildLadder(teams: string[], games: Game[]): LadderRow[] {
  const rows = new Map<string, LadderRow>(
    teams.map((t) => [t, { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]),
  );
  for (const g of games) {
    if (!g.score || g.round > LAST_REGULAR_ROUND) continue;
    const h = rows.get(g.home);
    const a = rows.get(g.away);
    if (!h || !a) continue;
    const { home, away } = g.score;
    h.p++; a.p++;
    h.gf += home; h.ga += away;
    a.gf += away; a.ga += home;
    if (home > away) { h.w++; a.l++; h.pts += 3; }
    else if (home < away) { a.w++; h.l++; a.pts += 3; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  // Same tie-breakers as the league: points, goal difference, goals scored.
  return [...rows.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team));
}

export function opponent(g: Game): string {
  return g.home === TEAM ? g.away : g.home;
}

export function ourScore(g: Game): { us: number; them: number } | null {
  if (!g.score) return null;
  return g.home === TEAM
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

// Team meets 30 min before kick-off for warm-up and a short practice.
export const MEET_BEFORE_MS = 30 * 60 * 1000;
const TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
export function meetingTime(g: Game): string {
  return TIME.format(new Date(g.kickoff.getTime() - MEET_BEFORE_MS)).replace(/\s*([ap])\.?m\.?/i, " $1m").toLowerCase();
}
export function formatDdmmyyyy(date: string): string {
  return formatDay(perthKickoff(date, "12:00 pm"));
}
