import { cookies } from "next/headers";
import { createHash } from "crypto";
import { isPlayerId } from "./players";

// No logins: a parent picks which child is theirs once and a cookie remembers
// it. The admin (season MVP tally, manual scores) is gated by ADMIN_PIN.

export const VOTER_COOKIE = "su_voter";
export const ADMIN_COOKIE = "su_admin";
export const YEAR = 60 * 60 * 24 * 365;

export async function currentVoter(): Promise<string | null> {
  const id = (await cookies()).get(VOTER_COOKIE)?.value;
  return id && isPlayerId(id) ? id : null;
}

export function adminToken(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  if (!pin) return null;
  return createHash("sha256").update(`storm-united:${pin}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const token = adminToken();
  return !!token && (await cookies()).get(ADMIN_COOKIE)?.value === token;
}
