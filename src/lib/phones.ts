import { cache } from "react";
import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";

// Which phones follow which children in a team, so managers can see who's
// connected ("Sam: 2 phones") and take a child off a phone that shouldn't have
// picked it. A phone is its private id (session's DEVICE_COOKIE); a child taken
// off a phone can't be picked on it again.
// Each phone is also one person in the team (people.ts): member_id is who it
// is in chat and private messages, with its relation to the children ("Dad",
// "Friend"…) and an optional name.

export type TeamPhone = {
  team_id: string;
  device_id: string;
  children: string; // player ids, comma-separated
  is_self: boolean;
  device: string | null; // "iPhone", "Android", "Computer"
  last_seen: string;
  removed_children: string;
  member_id?: string; // migration 028
  relation?: string | null;
  name?: string | null;
  created_at?: string;
};

export const ids = (s: string | null | undefined) => (s ?? "").split(",").filter(Boolean);

/** "iPhone", "Android" or "Computer", from the browser's description of itself. */
export function deviceKind(userAgent: string | null): string {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return /iPad/i.test(ua) ? "iPad" : "iPhone";
  if (/Android/i.test(ua)) return "Android";
  return "Computer";
}

/** Every phone in the team. Cached per request (labels for chat and messages need it often). */
export const listPhones = cache(async (teamId: string): Promise<TeamPhone[]> => {
  try {
    const s = db();
    if (!s) return ((await readLocal()).team_phones ?? []).filter((p) => p.team_id === teamId);
    return check(await s.from("team_phones").select("*").eq("team_id", teamId)) as TeamPhone[];
  } catch {
    return []; // e.g. before migration 025
  }
});

export async function getPhone(teamId: string, deviceId: string): Promise<TeamPhone | null> {
  const s = db();
  if (!s) return ((await readLocal()).team_phones ?? []).find((p) => p.team_id === teamId && p.device_id === deviceId) ?? null;
  return check(await s.from("team_phones").select("*").eq("team_id", teamId).eq("device_id", deviceId).maybeSingle()) as TeamPhone | null;
}

/** This phone in the team, cached per request. */
export const phoneFor = cache(async (teamId: string, deviceId: string): Promise<TeamPhone | null> => {
  try {
    return await getPhone(teamId, deviceId);
  } catch {
    return null;
  }
});

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
  const now = new Date().toISOString();
  await savePhone({
    team_id: teamId,
    device_id: deviceId,
    children: children.join(","),
    is_self: isSelf,
    device: deviceKind(userAgent),
    last_seen: now,
    removed_children: prev?.removed_children ?? "",
    member_id: prev?.member_id ?? randomUUID(),
    relation: prev?.relation ?? null,
    name: prev?.name ?? null,
    created_at: prev?.created_at ?? now,
  });
}

/** "I belong to…": who this phone's person is to the children ("Dad") and, optionally, their name. */
export async function setPhonePerson(teamId: string, deviceId: string, relation: string | null, name: string | null): Promise<boolean> {
  const prev = await getPhone(teamId, deviceId);
  if (!prev) return false;
  await savePhone({ ...prev, relation, name });
  return true;
}

/** Another phone that already is this player ("I am…"), if any. */
export async function selfTakenBy(teamId: string, childId: string, exceptDevice: string): Promise<TeamPhone | null> {
  return (
    (await listPhones(teamId)).find((p) => p.device_id !== exceptDevice && p.is_self && ids(p.children).includes(childId)) ?? null
  );
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
