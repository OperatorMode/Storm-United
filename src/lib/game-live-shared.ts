// My Game: what the sideline screen and the server share (no server code here,
// so the phone's side can use it too). See game-live.ts.

import { sportOf, type Sport, type SportId } from "./sports";

export type Spot = { x: number; y: number }; // percent across (x) and down (y) the field, our goal at the bottom
/** From `at` (ms of game time) on, these were on the field and this one in goal. */
export type LogEntry = { at: number; on: string[]; gk: string | null };
/** A finished game added to the season tallies (minutes per player). */
export type SavedStats = { played: Record<string, number>; rested: Record<string, number>; gk: Record<string, number>; at: string };
/** Scores by kind (see sports.ts): { goal: 2 }, { p2: 3, p3: 1 }, { goal: 5, behind: 3 }. */
export type Counts = Record<string, number>;
export type LiveGame = {
  sport?: SportId; // set by the server from the team
  onField: string[]; // player ids on the field
  pos: Record<string, Spot>; // where each one is
  bibs?: Record<string, string>; // netball: player id -> position (GS, GA...)
  clock: { elapsedMs: number; runningSince: string | null }; // paused: runningSince null
  marks?: Record<string, Counts>; // player id -> what they scored
  teamMarks?: Counts; // scored for us by the other team (own goal, rushed behind)
  themMarks?: Counts; // the other team's score
  wickets?: { us: number; them: number }; // cricket: wickets lost by each side
  batting?: { order: string[]; at: number }; // the batting order (set by the coach) and who's batting now
  // Before sports (soccer only): goals per player, own goals, their goals. Read through scoresOf().
  scorers: Record<string, number>;
  ownGoals: number;
  them: number;
  doneSwaps: number[]; // rotation swap times (minutes) already dealt with (done or skipped)
  ended: boolean;
  startedAt: string | null; // first kick-off
  log?: LogEntry[]; // who was on (and in goal) through the game, for playing time
  saved?: SavedStats | null; // "Save game data" pressed: counts in the tallies
};

export const emptyLive = (): LiveGame => ({
  onField: [],
  pos: {},
  bibs: {},
  clock: { elapsedMs: 0, runningSince: null },
  marks: {},
  teamMarks: {},
  themMarks: {},
  scorers: {},
  ownGoals: 0,
  them: 0,
  doneSwaps: [],
  ended: false,
  startedAt: null,
  log: [],
  saved: null,
});

/** The scores, also from games saved before sports. */
export function scoresOf(g: LiveGame): { mine: Record<string, Counts>; team: Counts; them: Counts } {
  return {
    mine: g.marks ?? Object.fromEntries(Object.entries(g.scorers ?? {}).map(([id, n]) => [id, { goal: n }])),
    team: g.teamMarks ?? (g.ownGoals ? { own: g.ownGoals } : {}),
    them: g.themMarks ?? (g.them ? { goal: g.them } : {}),
  };
}

const add = (a: Counts, b: Counts) => {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] ?? 0) + n;
  return out;
};

/** Our score by kind: every player's plus the team's. */
export function ourCounts(g: LiveGame): Counts {
  const { mine, team } = scoresOf(g);
  return Object.values(mine).reduce(add, team);
}

/** Points for these counts in this sport. */
export function pointsOf(sport: Sport, c: Counts): number {
  const kinds = [...sport.kinds, ...(sport.teamScore && !sport.kinds.some((k) => k.key === sport.teamScore!.key) ? [sport.teamScore] : [])];
  return kinds.reduce((n, k) => n + (c[k.key] ?? 0) * k.points, 0);
}

export const ourGoals = (g: LiveGame) => pointsOf(sportOf(g.sport), ourCounts(g));
export const theirGoals = (g: LiveGame) => pointsOf(sportOf(g.sport), scoresOf(g).them);

/** Who's in goal: the player furthest down in the goal area, if the sport has one. */
export function inGoal(onField: string[], pos: Record<string, Spot>, sport: Sport): string | null {
  if (!sport.keeper) return null;
  let best: string | null = null;
  for (const id of onField) if ((pos[id]?.y ?? 0) >= sport.keeper.area && (!best || pos[id].y > pos[best].y)) best = id;
  return best;
}

export const elapsedOf = (g: LiveGame, nowMs: number) => g.clock.elapsedMs + (g.clock.runningSince ? nowMs - Date.parse(g.clock.runningSince) : 0);

/** Notes who's on and who's in goal from this moment (called after each change). */
export function stamp(g: LiveGame, nowMs: number): LiveGame {
  const at = Math.round(elapsedOf(g, nowMs));
  const entry: LogEntry = { at, on: [...g.onField].sort(), gk: inGoal(g.onField, g.pos, sportOf(g.sport)) };
  const log = g.log ?? [];
  const last = log.at(-1);
  if (last && last.gk === entry.gk && last.on.join() === entry.on.join()) return g;
  // Changes at the same moment (or before kick-off) replace each other.
  return { ...g, log: last && last.at >= at ? [...log.slice(0, -1), entry] : [...log, entry] };
}

/** Each stretch of the game: from, to, who was on and in goal. */
function stretches(g: LiveGame): { from: number; to: number; on: string[]; gk: string | null }[] {
  const end = g.clock.elapsedMs;
  const log = g.log?.length ? g.log : [{ at: 0, on: g.onField, gk: inGoal(g.onField, g.pos, sportOf(g.sport)) }];
  return log
    .map((e, i) => ({ from: Math.min(e.at, end), to: Math.min(log[i + 1]?.at ?? end, end), on: e.on, gk: e.gk }))
    .filter((s) => s.to > s.from);
}

/** Milliseconds each player was on the field and in goal. */
export function playedTime(g: LiveGame): { played: Record<string, number>; gk: Record<string, number> } {
  const played: Record<string, number> = {};
  const gk: Record<string, number> = {};
  for (const s of stretches(g)) {
    for (const id of s.on) played[id] = (played[id] ?? 0) + (s.to - s.from);
    if (s.gk) gk[s.gk] = (gk[s.gk] ?? 0) + (s.to - s.from);
  }
  return { played, gk };
}

/** Who was in goal longest in each of `count` equal parts of the game (null: nobody). */
export function keeperByPart(g: LiveGame, count: number): (string | null)[] {
  const end = g.clock.elapsedMs;
  return Array.from({ length: count }, (_, k) => {
    const [a, b] = [(end * k) / count, (end * (k + 1)) / count];
    const t: Record<string, number> = {};
    for (const s of stretches(g)) if (s.gk) t[s.gk] = (t[s.gk] ?? 0) + Math.max(0, Math.min(b, s.to) - Math.max(a, s.from));
    const top = Object.entries(t).sort((x, y) => y[1] - x[1])[0];
    return top && top[1] > 0 ? top[0] : null;
  });
}
