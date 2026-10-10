import { cache } from "react";
import { check, db, readLocal, writeLocal } from "./store";

// Which phones follow which children in a team, so managers can see who's
// connected ("Sam: 2 phones") and take a child off a phone that shouldn't have
// picked it. A phone is its private id (session's DEVICE_COOKIE); a child taken
// off a phone can't be picked on it again.

export type TeamPhone = {
  team_id: string;
  device_id: string;
  children: string; // player ids, comma-separated
  is_self: boolean;
  device: string | null; // "iPhone", "Android", "Computer"
  last_seen: string;
  removed_children: string;
};

const ids = (s: string | null | undefined) => (s ?? "").split(",").filter(Boolean);

/** "iPhone", "Android" or "Computer", from the browser's description of itself. */
export function deviceKind(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return /iPad/i.test(ua) ? "iPad" : "iPhone";
  if (/Android/i.test(ua)) return "Android";
  return "Computer";
}

export async function listPhones(teamId: string): Promise<TeamPhone[]> {
  try {
    const s = db();
    if (!s) return ((await readLocal()).team_phones ?? []).filter((p) => p.team_id === teamId);
    return check(await s.from("team_phones").select("*").eq("team_id", teamId)) as TeamPhone[];
  } catch {
    return []; // e.g. before migration 025
  }
}

async function getPhone(teamId: string, deviceId: string): Promise<TeamPhone | null> {
  const s = db();
  if (!s) return ((await readLocal()).team_phones ?? []).find((p) => p.team_id === teamId && p.device_id === deviceId) ?? null;
  return check(await s.from("team_phones").select("*").eq("team_id", teamId).eq("device_id", deviceId).maybeSingle()) as TeamPhone | null;
}

async function savePhone(row: TeamPhone): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.team_phones = [...(d.team_phones ?? []).filter((p) => !(p.team_id === row.team_id && p.device_id === row.device_id)), row];
    return writeLocal(d);
  }
  check(await s.from("team_phones").upsert(row, { onConflict: "team_id,device_id" }));
}

/** Children a manager took off this phone (it can't pick them again). Cached per request. */
export const removedChildren = cache(async (teamId: string, deviceId: string): Promise<string[]> => {
  try {
    return ids((await getPhone(teamId, deviceId))?.removed_children);
  } catch {
    return [];
  }
});

/** Records what a phone follows now (when it picks children, or checks in). */
export async function recordPhone(teamId: string, deviceId: string, children: string[], isSelf: boolean, userAgent: string | null): Promise<void> {
  const prev = await getPhone(teamId, deviceId);
  await savePhone({
    team_id: teamId,
    device_id: deviceId,
    children: children.join(","),
    is_self: isSelf,
    device: deviceKind(userAgent),
    last_seen: new Date().toISOString(),
    removed_children: prev?.removed_children ?? "",
  });
}

/** A manager takes a child off one phone. */
export async function removeChildFromPhone(teamId: string, deviceId: string, childId: string): Promise<void> {
  const prev = await getPhone(teamId, deviceId);
  if (!prev) return;
  await savePhone({
    ...prev,
    children: ids(prev.children).filter((c) => c !== childId).join(","),
    removed_children: [...new Set([...ids(prev.removed_children), childId])].join(","),
  });
}
