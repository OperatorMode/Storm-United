import type { BallotRow } from "./store";
import { PLAYERS } from "./players";

// 3-2-1 voting: each ballot gives 3 points to first, 2 to second, 1 to third.
export type Tally = { playerId: string; points: number }[];

export function tally(ballots: BallotRow[]): Tally {
  const pts = new Map<string, number>(PLAYERS.map((p) => [p.id, 0]));
  for (const b of ballots) {
    pts.set(b.first, (pts.get(b.first) ?? 0) + 3);
    pts.set(b.second, (pts.get(b.second) ?? 0) + 2);
    pts.set(b.third, (pts.get(b.third) ?? 0) + 1);
  }
  return [...pts.entries()]
    .map(([playerId, points]) => ({ playerId, points }))
    .sort((a, b) => b.points - a.points);
}

// Everyone tied on the top score (empty if no votes).
export function winners(t: Tally): string[] {
  const top = t[0]?.points ?? 0;
  if (top === 0) return [];
  return t.filter((r) => r.points === top).map((r) => r.playerId);
}
