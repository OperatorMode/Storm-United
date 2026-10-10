import { createHash } from "crypto";
import { headers } from "next/headers";
import { check, db, readLocal, writeLocal } from "./store";

// Limits wrong guesses of PINs and codes: after MAX_FAILURES wrong tries in
// WINDOW from one device, that device is locked out for LOCK. A device is a
// hash of its internet address (the address itself is never stored), so
// clearing cookies doesn't reset the count.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

export type LimitKind = "pin" | "join" | "super" | "share" | "feedback";
type Row = { key: string; failures: number; window_start: string; locked_until: string | null };

async function deviceKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`sidelnr:${ip}`).digest("hex").slice(0, 24);
}

const keyFor = async (kind: LimitKind, scope: string) => `${kind}:${scope}:${await deviceKey()}`;

async function read(key: string): Promise<Row | null> {
  const s = db();
  if (!s) return ((await readLocal()).rate_limits ?? []).find((r) => r.key === key) ?? null;
  return check(await s.from("rate_limits").select("*").eq("key", key).maybeSingle()) as Row | null;
}

async function write(row: Row | null, key: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.rate_limits = (d.rate_limits ?? []).filter((r) => r.key !== key);
    if (row) d.rate_limits.push(row);
    return writeLocal(d);
  }
  if (row) check(await s.from("rate_limits").upsert(row, { onConflict: "key" }));
  else check(await s.from("rate_limits").delete().eq("key", key));
}

/** A message if this device is locked out right now, otherwise null. */
export async function lockedMessage(kind: LimitKind, scope: string): Promise<string | null> {
  const row = await read(await keyFor(kind, scope));
  const until = row?.locked_until ? new Date(row.locked_until).getTime() : 0;
  if (until <= Date.now()) return null;
  const mins = Math.ceil((until - Date.now()) / 60_000);
  const wait = `${mins} minute${mins === 1 ? "" : "s"}`;
  if (kind === "feedback") return `That's a lot of messages in a short time. Try again in ${wait}.`;
  return `Too many wrong tries. Try again in ${wait}.`;
}

/** Records a wrong try. Returns true when this try locked the device out. */
export async function recordFailure(kind: LimitKind, scope: string): Promise<boolean> {
  const key = await keyFor(kind, scope);
  const now = Date.now();
  const row = await read(key);
  const fresh = !row || now - new Date(row.window_start).getTime() > WINDOW_MS;
  const failures = (fresh ? 0 : row!.failures) + 1;
  const lockNow = failures >= MAX_FAILURES;
  await write(
    {
      key,
      failures: lockNow ? 0 : failures,
      window_start: fresh || lockNow ? new Date(now).toISOString() : row!.window_start,
      locked_until: lockNow ? new Date(now + LOCK_MS).toISOString() : (row?.locked_until ?? null),
    },
    key,
  );
  return lockNow;
}

/** A right answer clears the count. */
export async function recordSuccess(kind: LimitKind, scope: string): Promise<void> {
  const key = await keyFor(kind, scope);
  if (await read(key)) await write(null, key);
}
