"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAttendance, savePlayers, setAttendance, setManualScore, upsertTeam } from "@/lib/store";
import { getLeagueData } from "@/lib/league";
import { getTeam, hashSecret, isActivePlayer, mergePlayers, type Team } from "@/lib/teams";
import { goalieSlot } from "@/lib/goalies";
import { SUPER_COOKIE, adminCookie, isTeamAdmin } from "@/lib/session";

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

  const joinCode = String(formData.get("join_code") ?? "").trim();
  const clearJoin = formData.get("clear_join") === "on";
  if (joinCode && joinCode.length < 4) return { error: "Join code needs at least 4 characters." };

  const { players: _p, allPlayers: _a, ...row } = team; // eslint-disable-line @typescript-eslint/no-unused-vars
  await upsertTeam({
    ...row,
    meet_minutes: meet,
    goalie_enabled: formData.get("goalie_enabled") === "on",
    join_code_hash: clearJoin ? null : joinCode ? hashSecret(joinCode) : team.join_code_hash,
  });
  await savePlayers(team.id, players);
  refresh(team.id);
  return { ok: true };
}

// Locks Manager’s Corner on this device (team PIN and, if used, the super admin PIN).
export async function adminLogout(teamId: string) {
  const store = await cookies();
  store.delete(adminCookie(teamId));
  store.delete(SUPER_COOKIE);
  revalidatePath(`/${teamId}/admin`);
}
