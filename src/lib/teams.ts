import { cache } from "react";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { findTeamIdByJoinKey, getPlayers, getTeamRow, type PlayerRow, type TeamRow } from "./store";

export type Player = { id: string; name: string };
export type Team = TeamRow & {
  players: Player[]; // active squad, in display order
  allPlayers: PlayerRow[]; // includes removed players, for history (tallies)
};

// One fetch per request, however many components ask.
export const getTeam = cache(async (id: string): Promise<Team | null> => {
  const [row, allPlayers] = await Promise.all([getTeamRow(id), getPlayers(id)]);
  if (!row) return null;
  return { ...row, allPlayers, players: allPlayers.filter((p) => p.active).map(({ id, name }) => ({ id, name })) };
});

export function playerName(team: Team, id: string): string {
  return team.allPlayers.find((p) => p.id === id)?.name ?? id;
}

export function isActivePlayer(team: Team, id: string): boolean {
  return team.players.some((p) => p.id === id);
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}

// ---------- secrets (admin PIN, join code) ----------

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(normalise(secret), salt, 32).toString("hex")}`;
}

export function verifySecret(secret: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(normalise(secret), salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Join codes are shared with every family, so besides the salted hash (used to
// verify) we keep an unsalted lookup hash so the landing page can find a team
// from its code alone. Codes are unique across teams.
export function joinCodeKey(code: string): string {
  return createHash("sha256").update(`sidelnr-join:${normalise(code)}`).digest("hex");
}

export async function teamIdForJoinCode(code: string): Promise<string | null> {
  return code.trim() ? findTeamIdByJoinKey(joinCodeKey(code)) : null;
}

// New join-code columns for a team: set a new code, clear it, or keep the current one.
export async function joinCodeFields(
  teamId: string,
  change: { code: string; clear: boolean },
  current: Pick<TeamRow, "join_code_hash" | "join_code_key"> | null,
): Promise<{ join_code_hash: string | null; join_code_key: string | null } | { error: string }> {
  if (change.clear) return { join_code_hash: null, join_code_key: null };
  const code = change.code.trim();
  if (!code) return { join_code_hash: current?.join_code_hash ?? null, join_code_key: current?.join_code_key ?? null };
  if (code.length < 4) return { error: "Join code needs at least 4 characters." };
  const owner = await teamIdForJoinCode(code);
  if (owner && owner !== teamId) return { error: "That join code is already used by another team — pick a different one." };
  return { join_code_hash: hashSecret(code), join_code_key: joinCodeKey(code) };
}

// Codes are typed on phones: ignore case and stray spaces.
function normalise(s: string): string {
  return s.trim().toLowerCase();
}

// ---------- slugs & player lists ----------

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turns a pasted list of names (one per line) into player rows, keeping the
// ids of players who are already on the team so their attendance/votes stay
// attached. Players missing from the new list are kept but marked inactive.
export function mergePlayers(existing: PlayerRow[], names: string[]): PlayerRow[] {
  const clean = [...new Set(names.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean))];
  const used = new Set(existing.map((p) => p.id));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  const result: PlayerRow[] = clean.map((name, sort) => {
    const match = byName.get(name.toLowerCase());
    if (match) {
      byName.delete(name.toLowerCase());
      return { ...match, name, sort, active: true };
    }
    let id = slugify(name) || "player";
    for (let n = 2; used.has(id); n++) id = `${slugify(name) || "player"}-${n}`;
    used.add(id);
    return { id, name, sort, active: true };
  });
  for (const left of byName.values()) result.push({ ...left, active: false, sort: 1000 + left.sort });
  return result;
}
