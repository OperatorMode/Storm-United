"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { setManualScore } from "@/lib/store";
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

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}
