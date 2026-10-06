// Fair playing time: who's on, who rests, for each stretch of the game. Pure
// functions only, so the coach's screen can rebuild the plan instantly.
//
// A game is split into blocks: each half (or quarter) is cut every `swapEvery`
// minutes, e.g. 2 × 20-minute halves swapping every 10 minutes = 4 blocks.

export type Spot = "on" | "rest" | "gk";
export type RotationPlan = {
  periods: number; // number of blocks
  onField: number; // players on at once, including the goalkeeper
  spots: Record<string, Spot[]>; // player id -> one spot per block
  minutes?: number[]; // length of each block (older plans: 1 per block)
  labels?: string[]; // e.g. "1st 0'", "1st 10'"
  half?: ("1st" | "2nd")[]; // which half each block is in (for goalies)
  shape?: GameShape; // how the game was split (to offer the same next time)
};

export type GameShape = { parts: number; partMinutes: number; swapEvery: number };

const PART_NAMES: Record<number, string[]> = {
  1: [""],
  2: ["1st", "2nd"],
  3: ["1st", "2nd", "3rd"],
  4: ["Q1", "Q2", "Q3", "Q4"],
};

/** The blocks of a game: their lengths, labels and halves. */
export function blocksOf({ parts, partMinutes, swapEvery }: GameShape) {
  const step = swapEvery > 0 ? Math.min(swapEvery, partMinutes) : partMinutes;
  const minutes: number[] = [];
  const labels: string[] = [];
  const half: ("1st" | "2nd")[] = [];
  for (let p = 0; p < parts; p++) {
    for (let start = 0; start < partMinutes; start += step) {
      minutes.push(Math.min(step, partMinutes - start));
      const name = (PART_NAMES[parts] ?? [])[p] ?? `P${p + 1}`;
      labels.push(`${name}${name ? " " : ""}${start}'`);
      half.push(parts === 1 ? (start < partMinutes / 2 ? "1st" : "2nd") : p < parts / 2 ? "1st" : "2nd");
    }
  }
  return { minutes, labels, half };
}

/**
 * Builds a rotation: each half's goalie stays in goal; everyone else shares
 * the resting minutes so season totals even out. Each child gets a fair share
 * of this game's rest, and whoever has the fewest chances left to take it
 * (e.g. they're in goal next half) rests first. Nobody rests two blocks in a
 * row if it can be avoided.
 */
export function buildRotation(opts: {
  players: string[]; // available, in squad order
  shape: GameShape;
  onField: number;
  goalies: { first: string | null; second: string | null };
  restedSoFar: Record<string, number>; // minutes rested this season, before this game
}): RotationPlan {
  const { players, onField, goalies } = opts;
  const { minutes, labels, half } = blocksOf(opts.shape);
  const keeperOf = (i: number) => {
    const k = half[i] === "1st" ? goalies.first : goalies.second;
    return k && players.includes(k) ? k : null;
  };
  const restCountOf = (i: number) => {
    const gk = keeperOf(i);
    return Math.max(0, players.length - (gk ? 1 : 0) - Math.max(0, onField - (gk ? 1 : 0)));
  };

  // This game's rest, shared so everyone's season total ends up level.
  const soFar = (p: string) => opts.restedSoFar[p] ?? 0;
  const gameRest = minutes.reduce((sum, len, i) => sum + restCountOf(i) * len, 0);
  const level = (players.reduce((sum, p) => sum + soFar(p), 0) + gameRest) / Math.max(1, players.length);
  const target: Record<string, number> = Object.fromEntries(players.map((p) => [p, Math.max(0, level - soFar(p))]));

  const rested: Record<string, number> = Object.fromEntries(players.map((p) => [p, 0]));
  const spots: Record<string, Spot[]> = Object.fromEntries(players.map((p) => [p, []]));
  let lastRested = new Set<string>();

  minutes.forEach((len, i) => {
    const gk = keeperOf(i);
    const field = players.filter((p) => p !== gk);
    // Minutes this player could still rest from here on (not in goal).
    const chances = (p: string) => minutes.reduce((sum, l, j) => sum + (j >= i && keeperOf(j) !== p ? l : 0), 0);
    const urgency = (p: string) => (target[p] - rested[p]) / Math.max(1, chances(p)) - (lastRested.has(p) ? 0.5 : 0);
    const order = [...field].sort((a, b) => urgency(b) - urgency(a) || players.indexOf(a) - players.indexOf(b));
    const resting = new Set(order.slice(0, restCountOf(i)));
    for (const p of players) spots[p].push(p === gk ? "gk" : resting.has(p) ? "rest" : "on");
    for (const p of resting) rested[p] += len;
    lastRested = resting;
  });
  return { periods: minutes.length, onField, spots, minutes, labels, half, shape: opts.shape };
}

/** Minutes each player played / rested across saved plans. */
export function seasonTotals(plans: RotationPlan[]): Record<string, { played: number; rested: number }> {
  const totals: Record<string, { played: number; rested: number }> = {};
  for (const plan of plans) {
    for (const [player, list] of Object.entries(plan.spots)) {
      const t = (totals[player] ??= { played: 0, rested: 0 });
      list.forEach((s, i) => {
        const len = plan.minutes?.[i] ?? 1;
        if (s === "rest") t.rested += len;
        else t.played += len;
      });
    }
  }
  return totals;
}
