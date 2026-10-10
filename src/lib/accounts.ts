import { createHash, randomBytes, randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";

// Manager accounts: email + one-time login links. Same pattern as store.ts -
// Supabase in production, a local JSON file in dev.

export type Manager = { id: string; email: string; name: string | null };
export type TeamRole = "owner" | "manager";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_LINKS_PER_WINDOW = 5; // per email per 15 minutes

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

// Creates a one-time login token for `email` (only its hash is stored).
// Returns null when too many links were requested recently.
export async function createLoginToken(email: string): Promise<string | null> {
  const addr = normaliseEmail(email);
  const since = new Date(Date.now() - TOKEN_TTL_MS).toISOString();
  const token = randomBytes(32).toString("base64url");
  const row = {
    token_hash: hashToken(token),
    email: addr,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    used_at: null,
    created_at: new Date().toISOString(),
  };
  const s = db();
  if (!s) {
    const d = await readLocal();
    const recent = (d.login_tokens ?? []).filter((t) => t.email === addr && t.created_at > since).length;
    if (recent >= MAX_LINKS_PER_WINDOW) return null;
    (d.login_tokens ??= []).push(row);
    await writeLocal(d);
    return token;
  }
  const { count } = await s
    .from("login_tokens")
    .select("token_hash", { count: "exact", head: true })
    .eq("email", addr)
    .gt("created_at", since);
  if ((count ?? 0) >= MAX_LINKS_PER_WINDOW) return null;
  check(await s.from("login_tokens").insert(row));
  return token;
}

// Marks a token used and returns its email, or null if unknown/expired/used.
export async function consumeLoginToken(token: string): Promise<string | null> {
  const hash = hashToken(token);
  const now = new Date().toISOString();
  const s = db();
  if (!s) {
    const d = await readLocal();
    const t = (d.login_tokens ?? []).find((x) => x.token_hash === hash);
    if (!t || t.used_at || t.expires_at < now) return null;
    t.used_at = now;
    await writeLocal(d);
    return t.email;
  }
  // Single conditional update, so a link can't be used twice even if clicked twice at once.
  const rows = check(
    await s
      .from("login_tokens")
      .update({ used_at: now })
      .eq("token_hash", hash)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("email"),
  ) as { email: string }[];
  return rows[0]?.email ?? null;
}

export async function upsertManager(email: string): Promise<Manager> {
  const addr = normaliseEmail(email);
  const s = db();
  if (!s) {
    const d = await readLocal();
    let m = (d.managers ??= []).find((x) => x.email === addr);
    if (!m) {
      m = { id: randomUUID(), email: addr, name: null, created_at: new Date().toISOString() };
      d.managers.push(m);
      await writeLocal(d);
    }
    return { id: m.id, email: m.email, name: m.name };
  }
  return check(
    await s.from("managers").upsert({ email: addr }, { onConflict: "email" }).select("id, email, name").single(),
  ) as Manager;
}

export async function getManager(id: string): Promise<Manager | null> {
  const s = db();
  if (!s) {
    const m = ((await readLocal()).managers ?? []).find((x) => x.id === id);
    return m ? { id: m.id, email: m.email, name: m.name } : null;
  }
  return check(await s.from("managers").select("id, email, name").eq("id", id).maybeSingle()) as Manager | null;
}

export async function managedTeams(managerId: string): Promise<{ team_id: string; role: TeamRole }[]> {
  const s = db();
  if (!s) {
    return ((await readLocal()).team_managers ?? [])
      .filter((x) => x.manager_id === managerId)
      .map(({ team_id, role }) => ({ team_id, role }));
  }
  return check(await s.from("team_managers").select("team_id, role").eq("manager_id", managerId).order("created_at"));
}

export async function teamManagerIds(teamId: string): Promise<string[]> {
  const s = db();
  if (!s) {
    return ((await readLocal()).team_managers ?? []).filter((x) => x.team_id === teamId).map((x) => x.manager_id);
  }
  return (check(await s.from("team_managers").select("manager_id").eq("team_id", teamId)) as { manager_id: string }[]).map(
    (r) => r.manager_id,
  );
}

// Links a manager to a team. The first manager of a team becomes its owner.
export async function linkManager(teamId: string, managerId: string): Promise<void> {
  const existing = await teamManagerIds(teamId);
  if (existing.includes(managerId)) return;
  const row = {
    team_id: teamId,
    manager_id: managerId,
    role: (existing.length ? "manager" : "owner") as TeamRole,
    created_at: new Date().toISOString(),
  };
  const s = db();
  if (!s) {
    const d = await readLocal();
    (d.team_managers ??= []).push(row);
    return writeLocal(d);
  }
  check(await s.from("team_managers").upsert(row, { onConflict: "team_id,manager_id" }));
}

/**
 * A manager stops managing a team. The team carries on (its families, its
 * PIN). If they were its owner, the longest-serving other manager becomes owner.
 */
export async function unlinkManager(teamId: string, managerId: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    const rows = d.team_managers ?? [];
    const leaving = rows.find((x) => x.team_id === teamId && x.manager_id === managerId);
    let rest = rows.filter((x) => !(x.team_id === teamId && x.manager_id === managerId));
    const others = rest.filter((x) => x.team_id === teamId).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (leaving?.role === "owner" && others.length && !others.some((x) => x.role === "owner")) {
      rest = rest.map((x) => (x === others[0] ? { ...x, role: "owner" as TeamRole } : x));
    }
    d.team_managers = rest;
    return writeLocal(d);
  }
  const rows = check(await s.from("team_managers").select("manager_id, role, created_at").eq("team_id", teamId).order("created_at")) as {
    manager_id: string;
    role: TeamRole;
    created_at: string;
  }[];
  const leaving = rows.find((r) => r.manager_id === managerId);
  if (!leaving) return;
  check(await s.from("team_managers").delete().eq("team_id", teamId).eq("manager_id", managerId));
  const others = rows.filter((r) => r.manager_id !== managerId);
  if (leaving.role === "owner" && others.length && !others.some((r) => r.role === "owner")) {
    check(await s.from("team_managers").update({ role: "owner" }).eq("team_id", teamId).eq("manager_id", others[0].manager_id));
  }
}

/**
 * Deletes a manager account: off every team (owners handed on as above) and
 * league, its sign-in links and waiting league requests, then the account
 * itself. Teams and leagues stay for everyone else.
 */
export async function deleteManagerAccount(managerId: string): Promise<void> {
  const me = await getManager(managerId);
  if (!me) return;
  for (const t of await managedTeams(managerId)) await unlinkManager(t.team_id, managerId);
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.league_admins = (d.league_admins ?? []).filter((x) => x.manager_id !== managerId);
    d.league_claims = (d.league_claims ?? []).filter((c) => !(c.manager_id === managerId && c.status === "pending"));
    d.login_tokens = (d.login_tokens ?? []).filter((t) => t.email !== me.email);
    d.managers = (d.managers ?? []).filter((m) => m.id !== managerId);
    return writeLocal(d);
  }
  check(await s.from("league_admins").delete().eq("manager_id", managerId));
  check(await s.from("league_claims").delete().eq("manager_id", managerId).eq("status", "pending"));
  check(await s.from("login_tokens").delete().eq("email", me.email));
  check(await s.from("managers").delete().eq("id", managerId));
}
