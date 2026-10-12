// My Game: what the sideline screen and the server share (no server code here,
// so the phone's side can use it too). See game-live.ts.

export type Spot = { x: number; y: number }; // percent across (x) and down (y) the pitch, our goal at the bottom
/** From `at` (ms of game time) on, these were on the field and this one in goal. */
export type LogEntry = { at: number; on: string[]; gk: string | null };
/** A finished game added to the season tallies (minutes per player). */
export type SavedStats = { played: Record<string, number>; rested: Record<string, number>; gk: Record<string, number>; at: string };
export type LiveGame = {
  onField: string[]; // player ids on the field
  pos: Record<string, Spot>; // where each one is
  clock: { elapsedMs: number; runningSince: string | null }; // paused: runningSince null
  scorers: Record<string, number>; // player id -> goals
  ownGoals: number; // goals for us scored by the other team
  them: number; // their goals
  doneSwaps: number[]; // rotation swap times (minutes) already dealt with (done or skipped)
  ended: boolean;
  startedAt: string | null; // first kick-off
  log?: LogEntry[]; // who was on (and in goal) through the game, for playing time
  saved?: SavedStats | null; // "Save game data" pressed: counts in the tallies
};


export const emptyLive = (): LiveGame => ({
  onField: [],
  pos: {},
  clock: { elapsedMs: 0, runningSince: null },
  scorers: {},
  ownGoals: 0,
  them: 0,
  doneSwaps: [],
  ended: false,
  startedAt: null,
  log: [],
  saved: null,
});

export const ourGoals = (g: LiveGame) => Object.values(g.scorers).reduce((a, b) => a + b, 0) + g.ownGoals;

/** Lower than this on the pitch is the goal area. */
export const GOAL_Y = 82;

/** Who's in goal: the player furthest down in the goal area, if anyone. */
export function inGoal(onField: string[], pos: Record<string, Spot>): string | null {
  let best: string | null = null;
  for (const id of onField) if ((pos[id]?.y ?? 0) >= GOAL_Y && (!best || pos[id].y > pos[best].y)) best = id;
  return best;
}

export const elapsedOf = (g: LiveGame, nowMs: number) => g.clock.elapsedMs + (g.clock.runningSince ? nowMs - Date.parse(g.clock.runningSince) : 0);

/** Notes who's on and who's in goal from this moment (called after each change). */
export function stamp(g: LiveGame, nowMs: number): LiveGame {
  const at = Math.round(elapsedOf(g, nowMs));
  const entry: LogEntry = { at, on: [...g.onField].sort(), gk: inGoal(g.onField, g.pos) };
  const log = g.log ?? [];
  const last = log.at(-1);
  if (last && last.gk === entry.gk && last.on.join() === entry.on.join()) return g;
  // Changes at the same moment (or before kick-off) replace each other.
  return { ...g, log: last && last.at >= at ? [...log.slice(0, -1), entry] : [...log, entry] };
}

/** Each stretch of the game: from, to, who was on and in goal. */
function stretches(g: LiveGame): { from: number; to: number; on: string[]; gk: string | null }[] {
  const end = g.clock.elapsedMs;
  const log = g.log?.length ? g.log : [{ at: 0, on: g.onField, gk: inGoal(g.onField, g.pos) }];
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
