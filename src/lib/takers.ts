import { check, db, readLocal, writeLocal } from "./store";

// Clash solver (My Activities): who in the family takes each child to a game,
// training or activity. Stored per household, by the entry's key.

export type TakerRow = { household_id: string; entry_key: string; taker: string; updated_at: string };

export const TAKER_MAX = 24;

/** entry key -> who's taking them. */
export async function listTakers(householdId: string): Promise<Record<string, string>> {
  try {
    const s = db();
    const rows: TakerRow[] = s
      ? (check(await s.from("clash_takers").select("*").eq("household_id", householdId)) as TakerRow[])
      : ((await readLocal()).clash_takers ?? []).filter((r) => r.household_id === householdId);
    return Object.fromEntries(rows.map((r) => [r.entry_key, r.taker]));
  } catch {
    return {}; // e.g. before migration 031
  }
}

/** Sets (or, with null, clears) who's taking them. */
export async function setTaker(householdId: string, entryKey: string, taker: string | null): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.clash_takers = (d.clash_takers ?? []).filter((r) => !(r.household_id === householdId && r.entry_key === entryKey));
    if (taker) d.clash_takers.push({ household_id: householdId, entry_key: entryKey, taker, updated_at: new Date().toISOString() });
    return writeLocal(d);
  }
  if (taker) check(await s.from("clash_takers").upsert({ household_id: householdId, entry_key: entryKey, taker, updated_at: new Date().toISOString() }));
  else check(await s.from("clash_takers").delete().eq("household_id", householdId).eq("entry_key", entryKey));
}
