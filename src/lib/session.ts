import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { isActivePlayer, type Team } from "./teams";
import { getManager, managedTeams, type Manager } from "./accounts";

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
export const MANAGER_COOKIE = "su_mgr";

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

// ---------- manager accounts (signed session cookie) ----------

function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET ??
    sha(`sidelnr-session:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ADMIN_PIN ?? "local-dev"}`)
  );
}
const sign = (payload: string) => createHmac("sha256", sessionSecret()).update(payload).digest("base64url");

// Cookie value for a signed-in manager: "<id>.<expiry ms>.<signature>".
export function managerSessionValue(managerId: string): string {
  const payload = `${managerId}.${Date.now() + YEAR * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export const currentManagerId = cache(async (): Promise<string | null> => {
  const raw = (await cookies()).get(MANAGER_COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
});

export const currentManager = cache(async (): Promise<Manager | null> => {
  const id = await currentManagerId();
  return id ? getManager(id) : null;
});

const myTeamIds = cache(async (): Promise<string[]> => {
  const id = await currentManagerId();
  return id ? (await managedTeams(id)).map((t) => t.team_id) : [];
});

// Team admin = super admin, the team PIN on this device, or a signed-in manager of the team.
export async function isTeamAdmin(team: Team): Promise<boolean> {
  if (await isSuperAdmin()) return true;
  const token = adminToken(team);
  if (token && (await cookies()).get(adminCookie(team.id))?.value === token) return true;
  return (await myTeamIds()).includes(team.id);
}

// Whether this browser may see the team's page at all.
export async function canView(team: Team): Promise<boolean> {
  const token = joinToken(team);
  if (!token) return true;
  if ((await cookies()).get(joinCookie(team.id))?.value === token) return true;
  return isTeamAdmin(team);
}

// Storm United parents who picked their child before teams had their own links
// still carry the old un-scoped cookie; honour it so they don't have to re-pick.
const LEGACY_VOTER_COOKIE = "su_voter";
const LEGACY_TEAM = "storm-united";

export async function currentVoter(team: Team): Promise<string | null> {
  const store = await cookies();
  const id =
    store.get(voterCookie(team.id))?.value ??
    (team.id === LEGACY_TEAM ? store.get(LEGACY_VOTER_COOKIE)?.value : undefined);
  return id && isActivePlayer(team, id) ? id : null;
}

// Who this browser posts as in the team chat: the coach (team admin) or a family.
export async function chatAuthor(team: Team): Promise<string | null> {
  if (await isTeamAdmin(team)) return "coach";
  return currentVoter(team);
}
