import { cache } from "react";
import { check, db, readLocal, writeLocal } from "./store";
import type { RotationPlan } from "./rotation-plan";

// Saved rotations (one per game). Reads never break a page: before migration
// 010 runs there are simply none.
export const listRotations = cache(async (teamId: string): Promise<Record<string, RotationPlan>> => {
  try {
    const s = db();
    const rows = s
      ? (check(await s.from("game_rotations").select("game_id, plan").eq("team_id", teamId)) as { game_id: string; plan: RotationPlan }[])
      : ((await readLocal()).game_rotations ?? []).filter((r) => r.team_id === teamId).map((r) => ({ game_id: r.game_id, plan: r.plan as RotationPlan }));
    return Object.fromEntries(rows.map((r) => [r.game_id, r.plan]));
  } catch (err) {
    console.error("rotations unavailable", err);
    return {};
  }
});

export async function saveRotation(teamId: string, gameId: string, plan: RotationPlan | null): Promise<void> {
  const s = db();
  const updated_at = new Date().toISOString();
  if (!s) {
    const d = await readLocal();
    d.game_rotations = (d.game_rotations ?? []).filter((r) => !(r.team_id === teamId && r.game_id === gameId));
    if (plan) d.game_rotations.push({ team_id: teamId, game_id: gameId, plan, updated_at });
    return writeLocal(d);
  }
  if (!plan) {
    check(await s.from("game_rotations").delete().eq("team_id", teamId).eq("game_id", gameId));
    return;
  }
  check(await s.from("game_rotations").upsert({ team_id: teamId, game_id: gameId, plan, updated_at }));
}
