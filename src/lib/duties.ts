import { cache } from "react";
import { check, db, readLocal, writeLocal } from "./store";

// Duty roster: the jobs a team needs filled each game (oranges, snacks, team
// manager on the day…) and which family is doing each one. A family is
// identified by its first child's id (the same id used for MVP ballots).

export const SUGGESTED_DUTIES = ["Oranges", "Snacks", "Team manager on the day", "Linesperson", "Pack up"];

export type DutySignup = { game_id: string; duty: string; player_id: string };

// Reads never break a page: before migration 010 runs, there are simply no duties.
export const listDuties = cache(async (teamId: string): Promise<string[]> => {
  try {
    const s = db();
    const rows = s
      ? (check(await s.from("team_duties").select("name, sort").eq("team_id", teamId)) as { name: string; sort: number }[])
      : ((await readLocal()).team_duties ?? []).filter((d) => d.team_id === teamId);
    return rows.sort((a, b) => a.sort - b.sort).map((d) => d.name);
  } catch (err) {
    console.error("duties unavailable", err);
    return [];
  }
});

export const listDutySignups = cache(async (teamId: string): Promise<DutySignup[]> => {
  try {
    const s = db();
    if (s) return check(await s.from("duty_signups").select("game_id, duty, player_id").eq("team_id", teamId)) as DutySignup[];
    return ((await readLocal()).duty_signups ?? []).filter((d) => d.team_id === teamId).map(({ game_id, duty, player_id }) => ({ game_id, duty, player_id }));
  } catch (err) {
    console.error("duty signups unavailable", err);
    return [];
  }
});

export async function saveDuties(teamId: string, names: string[]): Promise<void> {
  const rows = names.map((name, sort) => ({ team_id: teamId, name, sort }));
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.team_duties = [...(d.team_duties ?? []).filter((x) => x.team_id !== teamId), ...rows];
    return writeLocal(d);
  }
  check(await s.from("team_duties").delete().eq("team_id", teamId));
  if (rows.length) check(await s.from("team_duties").insert(rows));
}

/** Puts a family on a duty; false if someone already has it. */
export async function takeDuty(teamId: string, gameId: string, duty: string, playerId: string): Promise<boolean> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    const list = (d.duty_signups ??= []);
    if (list.some((x) => x.team_id === teamId && x.game_id === gameId && x.duty === duty)) return false;
    list.push({ team_id: teamId, game_id: gameId, duty, player_id: playerId, created_at: new Date().toISOString() });
    await writeLocal(d);
    return true;
  }
  const res = await s.from("duty_signups").insert({ team_id: teamId, game_id: gameId, duty, player_id: playerId });
  if (res.error?.code === "23505") return false;
  check(res);
  return true;
}

export async function releaseDuty(teamId: string, gameId: string, duty: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.duty_signups = (d.duty_signups ?? []).filter((x) => !(x.team_id === teamId && x.game_id === gameId && x.duty === duty));
    return writeLocal(d);
  }
  check(await s.from("duty_signups").delete().eq("team_id", teamId).eq("game_id", gameId).eq("duty", duty));
}
