import type { AttendanceRow } from "./store";
import { slotFrom, slotParts } from "./role";

// The special role's sign-ups (goalie, catcher...) live on the attendance row:
// players tick parts of the game, the coach can override them from /admin.
// These helpers turn them into per-part views.

/** Who has the role in each part of a game (player ids per part). */
export function roleByPart(attendance: AttendanceRow[], gameId: string, count: number): string[][] {
  const byPart: string[][] = Array.from({ length: count }, () => []);
  for (const a of attendance) {
    if (a.game_id !== gameId || !a.goalie) continue;
    for (const p of slotParts(a.goalie, count)) byPart[p].push(a.player_id);
  }
  return byPart;
}

/** A player's sign-up when the coach picks who has the role in each part. */
export function slotForPlayer(playerId: string, assigned: (string | null)[], count: number): string | null {
  return slotFrom(
    assigned.flatMap((id, p) => (id === playerId ? [p] : [])),
    count,
  );
}

export type RoleTallyRow = {
  playerId: string;
  parts: number;
  games: { gameId: string; round: number | null; slot: string }[];
};

/** Parts of games each player had the role, across the given games (a full game = every part). */
export function roleTally(
  attendance: AttendanceRow[],
  games: { id: string; round: number | null }[],
  playerIds: string[],
  count: number,
): RoleTallyRow[] {
  const round = new Map(games.map((g) => [g.id, g.round]));
  return playerIds
    .map((id) => {
      const mine = attendance
        .filter((a) => a.player_id === id && a.goalie && round.has(a.game_id))
        .map((a) => ({ gameId: a.game_id, round: round.get(a.game_id) ?? null, slot: a.goalie! }))
        .sort((x, y) => (x.round ?? 0) - (y.round ?? 0));
      return { playerId: id, parts: mine.reduce((n, g) => n + slotParts(g.slot, count).length, 0), games: mine };
    })
    .sort((a, b) => b.parts - a.parts);
}
