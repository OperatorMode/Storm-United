"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAttendance, getTeamRow, savePlayers, setAttendance, setManualScore, upsertTeam } from "@/lib/store";
import { competitionTeams, getCompetition, getLeagueData } from "@/lib/league";
import { getTeam, isActivePlayer, joinCodeFields, mergePlayers, type Team } from "@/lib/teams";
import { goalieSlot } from "@/lib/goalies";
import { mergePlayer } from "@/lib/merge";
import { MANAGER_COOKIE, SUPER_COOKIE, adminCookie, isTeamAdmin } from "@/lib/session";

async function adminTeam(teamId: string): Promise<Team | null> {
  const team = await getTeam(teamId);
  return team && (await isTeamAdmin(team)) ? team : null;
}

function refresh(teamId: string) {
  revalidatePath(`/${teamId}`);
  revalidatePath(`/${teamId}/admin`);
}

export async function saveManualScore(teamId: string, gameId: string, home: string, away: string) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  if (home === "" && away === "") {
    await setManualScore(team.id, gameId, null);
  } else {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      return { error: "Scores must be whole numbers." };
    }
    await setManualScore(team.id, gameId, { home: h, away: a });
  }
  refresh(team.id);
  return { ok: true };
}

// The coach's pick is final: whoever is chosen for each half gets that slot
// (and is marked as playing); every other goalie tick for the game is cleared.
export async function setGameGoalies(teamId: string, gameId: string, first: string | null, second: string | null) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  if ((first && !isActivePlayer(team, first)) || (second && !isActivePlayer(team, second))) {
    return { error: "Unknown player." };
  }
  const { ourGames } = await getLeagueData(team);
  if (!ourGames.some((g) => g.id === gameId)) return { error: "Game not found." };

  const rows = (await getAttendance(team.id)).filter((a) => a.game_id === gameId);
  for (const p of team.players) {
    const existing = rows.find((r) => r.player_id === p.id);
    const goalie = goalieSlot(p.id, first, second);
    if ((existing?.goalie ?? null) === goalie && (!goalie || existing?.status === "yes")) continue;
    await setAttendance(team.id, {
      game_id: gameId,
      player_id: p.id,
      status: goalie ? "yes" : (existing?.status ?? "yes"),
      goalie,
    });
  }
  refresh(team.id);
  return { ok: true };
}

// Settings a team's own admin can change: squad, join code, meeting time, goalie sign-up.
export async function saveTeamSettings(teamId: string, _: unknown, formData: FormData) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };

  const names = String(formData.get("players") ?? "").split("\n");
  const players = mergePlayers(team.allPlayers, names);
  if (!players.some((p) => p.active)) return { error: "Add at least one player." };

  const meet = Number(formData.get("meet_minutes"));
  if (!Number.isInteger(meet) || meet < 0 || meet > 120) return { error: "Meeting time must be 0–120 minutes." };

  const join = await joinCodeFields(
    team.id,
    { code: String(formData.get("join_code") ?? ""), clear: formData.get("clear_join") === "on" },
    team,
  );
  if ("error" in join) return { error: join.error };

  const { players: _p, allPlayers: _a, ...row } = team; // eslint-disable-line @typescript-eslint/no-unused-vars
  await upsertTeam({
    ...row,
    meet_minutes: meet,
    goalie_enabled: formData.get("goalie_enabled") === "on",
    ...join,
  });
  await savePlayers(team.id, players);
  refresh(team.id);
  return { ok: true };
}

// Locks Manager’s Corner on this device: team PIN, super admin PIN and email sign-in.
export async function adminLogout(teamId: string) {
  const store = await cookies();
  store.delete(adminCookie(teamId));
  store.delete(SUPER_COOKIE);
  store.delete(MANAGER_COOKIE);
  revalidatePath(`/${teamId}/admin`);
}

// Merges a removed player (e.g. an old spelling of a name) into a current one,
// moving their attendance, votes, acknowledgements and chat across.
export async function mergeRemovedPlayer(teamId: string, fromId: string, toId: string) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const from = team.allPlayers.find((p) => p.id === fromId && !p.active);
  if (!from) return { error: "Only removed players can be merged." };
  if (!isActivePlayer(team, toId)) return { error: "Pick a current player to merge into." };
  await mergePlayer(team.id, fromId, toId);
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// ---------- new season ----------

// Team names in a competition's draw (to pick "who are we" in the new season).
export async function drawTeamNames(teamId: string, competitionId: string): Promise<string[]> {
  if (!(await adminTeam(teamId))) return [];
  return competitionTeams(competitionId);
}

// Moves the team into its next season: new competition (and name in that
// draw), who's playing again, and new players. Attendance and votes from
// earlier seasons stay as history.
export async function rolloverSeason(
  teamId: string,
  input: { competitionId: string; leagueName: string; keep: string[]; newPlayers: string[] },
) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const competition = await getCompetition(input.competitionId);
  if (!competition) return { error: "Pick the competition for the new season." };
  const leagueName = input.leagueName.trim();
  if (!leagueName) return { error: "Enter your team’s name as it appears in that competition’s draw." };
  const kept = team.players.filter((p) => input.keep.includes(p.id)).map((p) => p.name);
  const added = input.newPlayers.map((n) => n.trim()).filter(Boolean);
  if (kept.length + added.length === 0) return { error: "The squad can’t be empty." };

  const row = await getTeamRow(team.id);
  if (!row) return { error: "Team not found." };
  await upsertTeam({ ...row, competition_id: competition.id, league_name: leagueName });
  await savePlayers(team.id, mergePlayers(team.allPlayers, [...kept, ...added]));
  revalidatePath(`/${team.id}`, "layout");
  revalidatePath("/me");
  return { ok: true };
}
