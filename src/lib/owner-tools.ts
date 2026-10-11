import { check, db, readLocal, upsertTeam, getTeamRow, writeLocal } from "./store";
import { getManager, normaliseEmail, type Manager } from "./accounts";

// The Sidelnr owner's few tools in the app. Sidelnr is run by its families and
// coaches: the owner page never shows what's inside a team or event (players,
// guests, answers, chat, messages). It can only step in: delete a team, event
// or account, take a manager off, reset a PIN. Emails show half hidden, enough
// to match a support request ("please take j…@gmail.com off").

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}…@${domain ?? ""}`;
}

export async function leagueAdminIds(leagueId: string): Promise<string[]> {
  const s = db();
  if (!s) return ((await readLocal()).league_admins ?? []).filter((a) => a.league_id === leagueId).map((a) => a.manager_id);
  return (check(await s.from("league_admins").select("manager_id").eq("league_id", leagueId)) as { manager_id: string }[]).map((r) => r.manager_id);
}

export async function removeLeagueAdmin(leagueId: string, managerId: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.league_admins = (d.league_admins ?? []).filter((a) => !(a.league_id === leagueId && a.manager_id === managerId));
    return writeLocal(d);
  }
  check(await s.from("league_admins").delete().eq("league_id", leagueId).eq("manager_id", managerId));
}

export async function managerByEmail(email: string): Promise<Manager | null> {
  const e = normaliseEmail(email);
  const s = db();
  if (!s) {
    const m = ((await readLocal()).managers ?? []).find((x) => x.email === e);
    return m ? getManager(m.id) : null;
  }
  const rows = check(await s.from("managers").select("id").eq("email", e).limit(1)) as { id: string }[];
  return rows[0] ? getManager(rows[0].id) : null;
}

/** Clears a team's PIN (or an event's organiser code): everyone unlocked with it is locked out. */
export async function clearTeamPin(teamId: string): Promise<void> {
  const row = await getTeamRow(teamId);
  if (row) await upsertTeam({ ...row, admin_pin_hash: null });
}
