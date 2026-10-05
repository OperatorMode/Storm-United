"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAttendance, setAttendance, setManualScore } from "@/lib/store";
import { getLeagueData } from "@/lib/league";
import { PLAYERS, isPlayerId } from "@/lib/players";
import { goalieSlot } from "@/lib/goalies";
import { ADMIN_COOKIE, isAdmin } from "@/lib/session";

export async function saveManualScore(gameId: string, home: string, away: string) {
  if (!(await isAdmin())) return { error: "Not authorised." };
  if (home === "" && away === "") {
    await setManualScore(gameId, null);
  } else {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      return { error: "Scores must be whole numbers." };
    }
    await setManualScore(gameId, { home: h, away: a });
  }
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

// The coach's pick is final: whoever is chosen for each half gets that slot
// (and is marked as playing); every other goalie tick for the game is cleared.
export async function setGameGoalies(gameId: string, first: string | null, second: string | null) {
  if (!(await isAdmin())) return { error: "Not authorised." };
  if ((first && !isPlayerId(first)) || (second && !isPlayerId(second))) return { error: "Unknown player." };
  const { ourGames } = await getLeagueData();
  if (!ourGames.some((g) => g.id === gameId)) return { error: "Game not found." };

  const rows = (await getAttendance()).filter((a) => a.game_id === gameId);
  for (const p of PLAYERS) {
    const existing = rows.find((r) => r.player_id === p.id);
    const goalie = goalieSlot(p.id, first, second);
    if ((existing?.goalie ?? null) === goalie && (!goalie || existing?.status === "yes")) continue;
    await setAttendance({
      game_id: gameId,
      player_id: p.id,
      status: goalie ? "yes" : (existing?.status ?? "yes"),
      goalie,
    });
  }
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}
