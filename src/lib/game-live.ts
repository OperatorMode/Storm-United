import { check, db, getTeamRow, readLocal, upsertTeam, writeLocal } from "./store";

// My Game: the coach's sideline screen for a game in progress. Who's on the
// field and where, the clock, and who scored. Saved as the coach goes, so a
// reload (or a second phone) carries on where it was, and families see the
// live score next to the team on their home screen.

import { ourGoals, type LiveGame, type Spot } from "./game-live-shared";
export { emptyLive, ourGoals, type LiveGame, type Spot } from "./game-live-shared";

type Row = { team_id: string; game_id: string; state: LiveGame; updated_at: string };

export async function getLive(teamId: string, gameId: string): Promise<LiveGame | null> {
  try {
    const s = db();
    if (!s) return ((await readLocal()).game_live ?? []).find((r) => r.team_id === teamId && r.game_id === gameId)?.state ?? null;
    const row = check(await s.from("game_live").select("state").eq("team_id", teamId).eq("game_id", gameId).maybeSingle()) as { state: LiveGame } | null;
    return row?.state ?? null;
  } catch {
    return null; // before migration 040
  }
}

export async function saveLive(teamId: string, gameId: string, state: LiveGame): Promise<void> {
  const row: Row = { team_id: teamId, game_id: gameId, state, updated_at: new Date().toISOString() };
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.game_live = [...(d.game_live ?? []).filter((r) => !(r.team_id === teamId && r.game_id === gameId)), row];
    return writeLocal(d);
  }
  check(await s.from("game_live").upsert(row, { onConflict: "team_id,game_id" }));
}

/** Games in progress (started, not ended, touched in the last 4 hours), for the live score on home screens. */
export async function liveScores(teamIds: string[]): Promise<Record<string, { us: number; them: number }>> {
  if (!teamIds.length) return {};
  try {
    const since = new Date(Date.now() - 4 * 3600_000).toISOString();
    const s = db();
    const rows: Row[] = s
      ? (check(await s.from("game_live").select("*").in("team_id", teamIds).gt("updated_at", since)) as Row[])
      : ((await readLocal()).game_live ?? []).filter((r) => teamIds.includes(r.team_id) && r.updated_at > since);
    const out: Record<string, { us: number; them: number }> = {};
    for (const r of rows) if (r.state.startedAt && !r.state.ended) out[r.team_id] = { us: ourGoals(r.state), them: r.state.them };
    return out;
  } catch {
    return {};
  }
}

/** Where each player usually plays: remembered for the next game. */
export async function saveFieldLayout(teamId: string, pos: Record<string, Spot>): Promise<void> {
  const row = await getTeamRow(teamId);
  if (!row) return;
  await upsertTeam({ ...row, field_layout: { ...(row.field_layout ?? {}), ...pos } });
}
