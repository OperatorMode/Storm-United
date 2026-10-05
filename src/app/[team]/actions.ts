"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLeagueData, votingState } from "@/lib/league";
import { getTeam, isActivePlayer, verifySecret, type Team } from "@/lib/teams";
import { now } from "@/lib/clock";
import { getAttendance, setAttendance, upsertBallot, type AttendanceStatus, type GoalieHalf } from "@/lib/store";
import {
  COOKIE_OPTS,
  SUPER_COOKIE,
  adminCookie,
  adminToken,
  canView,
  currentVoter,
  joinCookie,
  joinToken,
  superToken,
  voterCookie,
} from "@/lib/session";

// Loads the team and checks this browser is allowed in (join code).
async function teamFor(teamId: string): Promise<Team | null> {
  const team = await getTeam(teamId);
  return team && (await canView(team)) ? team : null;
}

async function findGame(team: Team, gameId: string) {
  const { ourGames } = await getLeagueData(team);
  return ourGames.find((g) => g.id === gameId) ?? null;
}

export async function chooseVoter(teamId: string, voterId: string) {
  const team = await teamFor(teamId);
  if (!team) return;
  const store = await cookies();
  if (!voterId) store.delete(voterCookie(team.id));
  else if (isActivePlayer(team, voterId)) store.set(voterCookie(team.id), voterId, COOKIE_OPTS);
  revalidatePath(`/${team.id}`);
}

// Sets attendance and/or the goalie volunteer slot. Volunteering for goal
// implies the child is playing; marking "Can't make it" clears any goalie slot.
export async function updateAttendance(
  teamId: string,
  gameId: string,
  change: { status: AttendanceStatus } | { goalie: GoalieHalf | null },
) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const voter = await currentVoter(team);
  if (!voter) return { error: "Pick your child first." };
  if ("status" in change && !["yes", "no", "maybe"].includes(change.status)) return { error: "Invalid status." };
  if ("goalie" in change) {
    if (!team.goalie_enabled) return { error: "Goalie sign-up is off for this team." };
    if (change.goalie !== null && !["1st", "2nd", "full"].includes(change.goalie)) return { error: "Invalid goalie choice." };
  }
  const game = await findGame(team, gameId);
  if (!game) return { error: "Game not found." };
  if (game.kickoff.getTime() < now().getTime()) return { error: "This game has already started." };

  const existing = (await getAttendance(team.id)).find((a) => a.game_id === gameId && a.player_id === voter);
  let status: AttendanceStatus;
  let goalie: GoalieHalf | null;
  if ("status" in change) {
    status = change.status;
    goalie = status === "no" ? null : (existing?.goalie ?? null);
  } else {
    goalie = change.goalie;
    status = goalie ? "yes" : (existing?.status ?? "yes");
  }
  await setAttendance(team.id, { game_id: gameId, player_id: voter, status, goalie });
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

export async function submitBallot(teamId: string, gameId: string, picks: string[]) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const voter = await currentVoter(team);
  if (!voter) return { error: "Pick your child first." };
  const game = await findGame(team, gameId);
  if (!game) return { error: "Game not found." };
  if (votingState(game) !== "open") return { error: "Voting isn't open for this game." };

  if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every((p) => isActivePlayer(team, p))) {
    return { error: "Pick three different players." };
  }
  if (picks.includes(voter)) return { error: "You can't vote for your own child." };
  const absent = (await getAttendance(team.id))
    .filter((a) => a.game_id === gameId && a.status === "no")
    .map((a) => a.player_id);
  if (picks.some((p) => absent.includes(p))) return { error: "One of those players didn't play." };

  await upsertBallot(team.id, { game_id: gameId, voter_id: voter, first: picks[0], second: picks[1], third: picks[2] });
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

export async function enterJoinCode(_: unknown, formData: FormData) {
  const team = await getTeam(String(formData.get("team") ?? ""));
  if (!team) return { error: "Team not found." };
  const token = joinToken(team);
  if (!token) return { ok: true };
  if (!verifySecret(String(formData.get("code") ?? ""), team.join_code_hash)) return { error: "That code isn't right." };
  (await cookies()).set(joinCookie(team.id), token, COOKIE_OPTS);
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

// Accepts the team's admin PIN, or the super admin PIN (unlocks every team).
export async function adminLogin(_: unknown, formData: FormData) {
  const team = await getTeam(String(formData.get("team") ?? ""));
  if (!team) return { error: "Team not found." };
  const pin = String(formData.get("pin") ?? "").trim();
  const store = await cookies();
  const superPin = process.env.ADMIN_PIN?.trim();
  if (superPin && pin === superPin) {
    store.set(SUPER_COOKIE, superToken()!, COOKIE_OPTS);
  } else if (verifySecret(pin, team.admin_pin_hash)) {
    store.set(adminCookie(team.id), adminToken(team)!, COOKIE_OPTS);
  } else {
    return { error: "Wrong PIN." };
  }
  revalidatePath(`/${team.id}/admin`);
  return { ok: true };
}
