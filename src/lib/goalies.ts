import type { AttendanceRow, GoalieHalf } from "./store";

// Goalie slots live on the attendance row (parents tick them, the coach can
// override them from /admin). These helpers turn them into per-half views.

export function goaliesForGame(attendance: AttendanceRow[], gameId: string) {
  const rows = attendance.filter((a) => a.game_id === gameId && a.goalie);
  return {
    first: rows.filter((r) => r.goalie === "1st" || r.goalie === "full").map((r) => r.player_id),
    second: rows.filter((r) => r.goalie === "2nd" || r.goalie === "full").map((r) => r.player_id),
  };
}

// The slot a player ends up with when the coach picks the two halves.
export function goalieSlot(playerId: string, first: string | null, second: string | null): GoalieHalf | null {
  const one = first === playerId;
  const two = second === playerId;
  return one && two ? "full" : one ? "1st" : two ? "2nd" : null;
}

export type GoalieTallyRow = {
  playerId: string;
  halves: number;
  games: { gameId: string; round: number; goalie: GoalieHalf }[];
};

// Halves in goal per player across the given games (a full game = 2 halves).
export function goalieTally(
  attendance: AttendanceRow[],
  games: { id: string; round: number }[],
  playerIds: string[],
): GoalieTallyRow[] {
  const round = new Map(games.map((g) => [g.id, g.round]));
  return playerIds.map((id) => {
    const mine = attendance
      .filter((a) => a.player_id === id && a.goalie && round.has(a.game_id))
      .map((a) => ({ gameId: a.game_id, round: round.get(a.game_id)!, goalie: a.goalie! }))
      .sort((x, y) => x.round - y.round);
    return {
      playerId: id,
      halves: mine.reduce((n, g) => n + (g.goalie === "full" ? 2 : 1), 0),
      games: mine,
    };
  }).sort((a, b) => b.halves - a.halves);
}
