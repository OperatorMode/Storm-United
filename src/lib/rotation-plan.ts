// Fair playing time: who's on, who rests, each period. Pure functions only, so
// the coach's screen can rebuild the plan instantly as they tweak it.

export type Spot = "on" | "rest" | "gk";
export type RotationPlan = {
  periods: number; // 2 halves, 4 quarters…
  onField: number; // players on at once, including the goalkeeper
  spots: Record<string, Spot[]>; // player id -> one spot per period
};

/** Which periods a half covers (halves map onto quarters 1–2 and 3–4). */
export const periodsInHalf = (periods: number, half: "1st" | "2nd") => {
  const all = Array.from({ length: periods }, (_, i) => i);
  if (periods % 2) return half === "1st" ? all : [];
  return half === "1st" ? all.slice(0, periods / 2) : all.slice(periods / 2);
};

/**
 * Builds a rotation: the goalie of each period stays in goal; everyone else
 * shares the rests, starting with whoever has rested least this season, and
 * nobody rests two periods in a row if it can be avoided.
 */
export function buildRotation(opts: {
  players: string[]; // available, in squad order
  periods: number;
  onField: number;
  goalies: (string | null)[]; // per period
  restsSoFar: Record<string, number>; // this season, before this game
}): RotationPlan {
  const { players, periods, onField, goalies } = opts;
  const rests: Record<string, number> = Object.fromEntries(players.map((p) => [p, opts.restsSoFar[p] ?? 0]));
  const spots: Record<string, Spot[]> = Object.fromEntries(players.map((p) => [p, []]));
  let lastRested = new Set<string>();

  for (let i = 0; i < periods; i++) {
    const gk = goalies[i] && players.includes(goalies[i]!) ? goalies[i] : null;
    const field = players.filter((p) => p !== gk);
    const needed = Math.max(0, onField - (gk ? 1 : 0));
    const restCount = Math.max(0, field.length - needed);
    // Least rested first; resting last period pushes you back; ties by squad order.
    const order = [...field].sort((a, b) => rests[a] + (lastRested.has(a) ? 0.5 : 0) - (rests[b] + (lastRested.has(b) ? 0.5 : 0)) || players.indexOf(a) - players.indexOf(b));
    const resting = new Set(order.slice(0, restCount));
    for (const p of players) spots[p].push(p === gk ? "gk" : resting.has(p) ? "rest" : "on");
    for (const p of resting) rests[p]++;
    lastRested = resting;
  }
  return { periods, onField, spots };
}

/** Periods each player rested / played across saved plans. */
export function seasonTotals(plans: RotationPlan[]): Record<string, { played: number; rested: number }> {
  const totals: Record<string, { played: number; rested: number }> = {};
  for (const plan of plans) {
    for (const [player, list] of Object.entries(plan.spots)) {
      const t = (totals[player] ??= { played: 0, rested: 0 });
      for (const s of list) {
        if (s === "rest") t.rested++;
        else t.played++;
      }
    }
  }
  return totals;
}
