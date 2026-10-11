import { cache } from "react";
import { check, db, readLocal, writeLocal } from "./store";

// "Who are you?": the name this phone's user chose (e.g. "John"), used across
// the app: as their answer to an event, and in every team next to who they are
// to the player ("John (Leo's Dad)").

export const NAME_MAX = 24;
type Row = { device_id: string; name: string; updated_at: string };

export const getDeviceName = cache(async (deviceId: string | null): Promise<string | null> => {
  if (!deviceId) return null;
  try {
    const s = db();
    if (!s) return ((await readLocal()).device_profiles ?? []).find((r) => r.device_id === deviceId)?.name ?? null;
    return ((check(await s.from("device_profiles").select("name").eq("device_id", deviceId).maybeSingle()) as { name: string } | null)?.name ?? null);
  } catch {
    return null; // before migration 034
  }
});

/** Saves the name, and puts it on this phone in every team where it hasn't chosen another. */
export async function setDeviceName(deviceId: string, name: string): Promise<void> {
  const previous = await getDeviceName(deviceId);
  const row: Row = { device_id: deviceId, name, updated_at: new Date().toISOString() };
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.device_profiles = [...(d.device_profiles ?? []).filter((r) => r.device_id !== deviceId), row];
    d.team_phones = (d.team_phones ?? []).map((p) => (p.device_id === deviceId && (!p.name || p.name === previous) ? { ...p, name } : p));
    return writeLocal(d);
  }
  check(await s.from("device_profiles").upsert(row, { onConflict: "device_id" }));
  check(await s.from("team_phones").update({ name }).eq("device_id", deviceId).is("name", null));
  if (previous && previous !== name) check(await s.from("team_phones").update({ name }).eq("device_id", deviceId).eq("name", previous));
}
