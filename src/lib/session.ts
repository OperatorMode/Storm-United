import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { isActivePlayer, type Team } from "./teams";
import { getManager, managedTeams, type Manager } from "./accounts";
import { removedChildren } from "./phones";

// No logins. Per team, a cookie remembers:
//  - which child this phone belongs to (voter),
//  - that the join code was entered (if the team has one),
//  - that the team admin PIN was entered.
// The super admin (ADMIN_PIN env var, the app owner) can see and manage every team.
// Cookie values are hashes derived from the stored secret, so changing a PIN
// or join code logs everyone out of that team.

export const YEAR = 60 * 60 * 24 * 365;
export const COOKIE_OPTS = { maxAge: YEAR, httpOnly: true, sameSite: "lax", secure: true, path: "/" } as const;

export const voterCookie = (teamId: string) => `su_voter_${teamId}`;
// Set when the phone belongs to a player themselves ("I am…"), not a parent.
export const selfCookie = (teamId: string) => `su_self_${teamId}`;
// The household this phone belongs to (My Activities); see activities.ts.
export const HOUSEHOLD_COOKIE = "su_household";

// This phone's own private id (My Activities): who created an activity, and
// which activities this phone has hidden. Households can span several phones.
export const DEVICE_COOKIE = "su_device";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** This phone's private id, if it has one yet. */
export async function currentDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  return UUID.test(v) ? v : null;
}

/** This phone's household id, if it has one. */
export async function currentHouseholdId(): Promise<string | null> {
  const v = (await cookies()).get(HOUSEHOLD_COOKIE)?.value ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
}
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

// The signed-in manager: a valid, unexpired signed cookie for an account that still exists.
export const currentManager = cache(async (): Promise<Manager | null> => {
  const raw = (await cookies()).get(MANAGER_COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig || Number(exp) < Date.now()) return null;
  const expected = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return getManager(id);
});

export const currentManagerId = cache(async (): Promise<string | null> => (await currentManager())?.id ?? null);

const myTeamIds = cache(async (): Promise<string[]> => {
  const id = await currentManagerId();
  return id ? (await managedTeams(id)).map((t) => t.team_id) : [];
});

// How this browser has access to a team's Manager's Corner, if at all: a
// signed-in manager of the team, the team's own PIN on this device, or the
// Sidelnr owner (super admin, every team).
export async function adminAccess(team: Team): Promise<"manager" | "pin" | "owner" | null> {
  if ((await myTeamIds()).includes(team.id)) return "manager";
  const token = adminToken(team);
  if (token && (await cookies()).get(adminCookie(team.id))?.value === token) return "pin";
  if (await isSuperAdmin()) return "owner";
  return null;
}

export async function isTeamAdmin(team: Team): Promise<boolean> {
  return (await adminAccess(team)) !== null;
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

/** The child, or children (siblings in the same team), this phone belongs to. */
export async function currentChildren(team: Team): Promise<string[]> {
  const store = await cookies();
  const raw =
    store.get(voterCookie(team.id))?.value ??
    (team.id === LEGACY_TEAM ? store.get(LEGACY_VOTER_COOKIE)?.value : undefined);
  const picked = [...new Set((raw ?? "").split(","))].filter((id) => id && isActivePlayer(team, id));
  const device = await currentDeviceId();
  if (!device || !picked.length) return picked;
  const removed = await removedChildren(team.id, device);
  return picked.filter((id) => !removed.includes(id));
}

/**
 * Who this phone is in private messages: the children it picked ("Sam's
 * parent") and, in Manager's Corner, "coach". Null for players' own phones
 * ("I am…"): private messages are for parents only.
 */
export async function dmIdentities(team: Team): Promise<string[] | null> {
  if (await isPlayerSelf(team)) return null;
  const ids = await currentChildren(team);
  return (await isTeamAdmin(team)) ? ["coach", ...ids] : ids;
}

/** Whether this phone is the player's own ("I am…") rather than a parent's. */
export async function isPlayerSelf(team: Team): Promise<boolean> {
  return (await cookies()).get(selfCookie(team.id))?.value === "1";
}

/**
 * The family's id: its first child. One MVP ballot per family, chat posts
 * and message acknowledgements hang off it.
 */
export async function currentVoter(team: Team): Promise<string | null> {
  return (await currentChildren(team))[0] ?? null;
}

// Who this browser posts as in the team chat: the coach (team admin) or a family.
export async function chatAuthor(team: Team): Promise<string | null> {
  if (await isTeamAdmin(team)) return "coach";
  return currentVoter(team);
}
