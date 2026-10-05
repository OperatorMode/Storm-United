import { cookies } from "next/headers";
import { createHash } from "crypto";
import { isActivePlayer, type Team } from "./teams";

// No logins. Per team, a cookie remembers:
//  - which child this phone belongs to (voter),
//  - that the join code was entered (if the team has one),
//  - that the team admin PIN was entered.
// The super admin (ADMIN_PIN env var — the app owner) can see and manage every team.
// Cookie values are hashes derived from the stored secret, so changing a PIN
// or join code logs everyone out of that team.

export const YEAR = 60 * 60 * 24 * 365;
export const COOKIE_OPTS = { maxAge: YEAR, httpOnly: true, sameSite: "lax", secure: true, path: "/" } as const;

export const voterCookie = (teamId: string) => `su_voter_${teamId}`;
export const joinCookie = (teamId: string) => `su_join_${teamId}`;
export const adminCookie = (teamId: string) => `su_admin_${teamId}`;
export const SUPER_COOKIE = "su_super";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function joinToken(team: Team): string | null {
  return team.join_code_hash ? sha(`join:${team.id}:${team.join_code_hash}`) : null;
}
export function adminToken(team: Team): string | null {
  return team.admin_pin_hash ? sha(`admin:${team.id}:${team.admin_pin_hash}`) : null;
}
export function superToken(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  return pin ? sha(`super:${pin}`) : null;
}

export async function isSuperAdmin(): Promise<boolean> {
  const token = superToken();
  return !!token && (await cookies()).get(SUPER_COOKIE)?.value === token;
}

export async function isTeamAdmin(team: Team): Promise<boolean> {
  if (await isSuperAdmin()) return true;
  const token = adminToken(team);
  return !!token && (await cookies()).get(adminCookie(team.id))?.value === token;
}

// Whether this browser may see the team's page at all.
export async function canView(team: Team): Promise<boolean> {
  const token = joinToken(team);
  if (!token) return true;
  if ((await cookies()).get(joinCookie(team.id))?.value === token) return true;
  return isTeamAdmin(team);
}

export async function currentVoter(team: Team): Promise<string | null> {
  const id = (await cookies()).get(voterCookie(team.id))?.value;
  return id && isActivePlayer(team, id) ? id : null;
}
