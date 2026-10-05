"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLeagueData, votingState } from "@/lib/league";
import { isPlayerId, isVoterId } from "@/lib/players";
import { now } from "@/lib/clock";
import { getAttendance, setAttendance, upsertBallot, type AttendanceStatus } from "@/lib/store";
import { ADMIN_COOKIE, VOTER_COOKIE, YEAR, adminToken, currentVoter } from "@/lib/session";

export async function chooseVoter(voterId: string) {
  const store = await cookies();
  if (!voterId) store.delete(VOTER_COOKIE);
  else if (isVoterId(voterId)) {
    store.set(VOTER_COOKIE, voterId, { maxAge: YEAR, httpOnly: true, sameSite: "lax", secure: true });
  }
  revalidatePath("/");
}

async function findGame(gameId: string) {
  const { ourGames } = await getLeagueData();
  return ourGames.find((g) => g.id === gameId) ?? null;
}

export async function markAttendance(gameId: string, status: AttendanceStatus) {
  const voter = await currentVoter();
  if (!voter || !isPlayerId(voter)) return { error: "Pick your child first." };
  if (!["yes", "no", "maybe"].includes(status)) return { error: "Invalid status." };
  const game = await findGame(gameId);
  if (!game) return { error: "Game not found." };
  if (game.kickoff.getTime() < now().getTime()) return { error: "This game has already started." };
  await setAttendance({ game_id: gameId, player_id: voter, status });
  revalidatePath("/");
  return { ok: true };
}

export async function submitBallot(gameId: string, picks: string[]) {
  const voter = await currentVoter();
  if (!voter) return { error: "Pick who you are first." };
  const game = await findGame(gameId);
  if (!game) return { error: "Game not found." };
  if (votingState(game) !== "open") return { error: "Voting isn't open for this game." };

  if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every(isPlayerId)) {
    return { error: "Pick three different players." };
  }
  if (picks.includes(voter)) return { error: "You can't vote for your own child." };
  const absent = (await getAttendance())
    .filter((a) => a.game_id === gameId && a.status === "no")
    .map((a) => a.player_id);
  if (picks.some((p) => absent.includes(p))) return { error: "One of those players didn't play." };

  await upsertBallot({ game_id: gameId, voter_id: voter, first: picks[0], second: picks[1], third: picks[2] });
  revalidatePath("/");
  return { ok: true };
}

export async function adminLogin(_: unknown, formData: FormData) {
  const token = adminToken();
  if (!token) return { error: "ADMIN_PIN isn't configured." };
  const pin = String(formData.get("pin") ?? "");
  if (pin !== process.env.ADMIN_PIN) return { error: "Wrong PIN." };
  (await cookies()).set(ADMIN_COOKIE, token, { maxAge: YEAR, httpOnly: true, sameSite: "lax", secure: true });
  revalidatePath("/admin");
  return { ok: true };
}
