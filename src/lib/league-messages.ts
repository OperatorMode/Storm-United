import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";

// Messages from a league's admin to the Sidelnr teams in it: to everyone
// (also posted on each team's Board) or to the team managers only.
// Same pattern as store.ts: Supabase in production, a local JSON file in dev.

export type LeagueMessage = {
  id: string;
  league_id: string;
  competition_id: string | null; // null: every competition in the league
  audience: "all" | "managers";
  body: string;
  teams: number; // Sidelnr teams it reached
  created_at: string;
};

const COLS = "id, league_id, competition_id, audience, body, teams, created_at";

/** Newest first. */
export async function listLeagueMessages(leagueId: string, limit = 20): Promise<LeagueMessage[]> {
  const s = db();
  if (!s) {
    return ((await readLocal()).league_messages ?? [])
      .filter((m) => m.league_id === leagueId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  return check(await s.from("league_messages").select(COLS).eq("league_id", leagueId).order("created_at", { ascending: false }).limit(limit));
}

/** The league's messages that reached a team in this competition. */
export async function leagueMessagesFor(leagueId: string, competitionId: string): Promise<LeagueMessage[]> {
  return (await listLeagueMessages(leagueId)).filter((m) => !m.competition_id || m.competition_id === competitionId);
}

export async function addLeagueMessage(m: Omit<LeagueMessage, "id" | "created_at">): Promise<LeagueMessage> {
  const row: LeagueMessage = { ...m, id: randomUUID(), created_at: new Date().toISOString() };
  const s = db();
  if (!s) {
    const data = await readLocal();
    (data.league_messages ??= []).push(row);
    await writeLocal(data);
    return row;
  }
  check(await s.from("league_messages").insert(row));
  return row;
}
