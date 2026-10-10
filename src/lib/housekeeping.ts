import { db, readLocal, writeLocal } from "./store";

// Owner page housekeeping: how big the database is, and records that are no
// longer needed. Only leftovers go: nothing anyone wrote or chose (messages,
// attendance, teams, activities) is ever touched.

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type Rule = {
  key: string;
  label: string; // what it is, for the owner page
  table: string;
  local: (r: Record<string, unknown>, now: string) => boolean; // matches in the local file
  // The same filter on Supabase.
  filter: <Q extends { lt: (c: string, v: string) => Q; or: (f: string) => Q; eq: (c: string, v: string | boolean) => Q }>(q: Q, now: string) => Q;
};

const RULES: Rule[] = [
  {
    key: "login_tokens",
    label: "Used or expired sign-in links (older than a day)",
    table: "login_tokens",
    local: (r) => String(r.expires_at) < ago(1),
    filter: (q) => q.lt("expires_at", ago(1)),
  },
  {
    key: "rate_limits",
    label: "Wrong-PIN counters that have run out",
    table: "rate_limits",
    local: (r, now) => String(r.window_start) < ago(1) && (!r.locked_until || String(r.locked_until) < now),
    filter: (q, now) => q.lt("window_start", ago(1)).or(`locked_until.is.null,locked_until.lt."${now}"`),
  },
  {
    key: "notification_log",
    label: "Sent-notification records older than 90 days",
    table: "notification_log",
    local: (r) => String(r.sent_at) < ago(90),
    filter: (q) => q.lt("sent_at", ago(90)),
  },
  {
    key: "activity_reminder_log",
    label: "Activity reminder records older than 30 days",
    table: "activity_reminder_log",
    local: (r) => String(r.sent_at) < ago(30),
    filter: (q) => q.lt("sent_at", ago(30)),
  },
  {
    key: "feedback",
    label: "Feedback marked done, older than 6 months",
    table: "feedback",
    local: (r) => r.done === true && String(r.created_at) < ago(182),
    filter: (q) => q.eq("done", true).lt("created_at", ago(182)),
  },
];

export type Usage = { databaseBytes: number | null; tables: { name: string; rows: number; bytes: number }[] };

/** Database size (Supabase only; null locally) and its largest tables. */
export async function databaseUsage(): Promise<Usage> {
  const s = db();
  if (!s) return { databaseBytes: null, tables: [] };
  try {
    const { data, error } = await s.rpc("sidelnr_usage");
    if (error || !data) return { databaseBytes: null, tables: [] };
    const u = data as { database_bytes: number; tables: { name: string; rows: number; bytes: number }[] };
    return { databaseBytes: u.database_bytes, tables: u.tables ?? [] };
  } catch {
    return { databaseBytes: null, tables: [] }; // e.g. before migration 030
  }
}

/** How many old records each clean-up would remove. */
export async function cleanupCounts(): Promise<{ key: string; label: string; count: number }[]> {
  const s = db();
  const now = new Date().toISOString();
  const local = s ? null : ((await readLocal()) as unknown as Record<string, Record<string, unknown>[] | undefined>);
  const out = [];
  for (const r of RULES) {
    let count = 0;
    try {
      if (local) count = (local[r.table] ?? []).filter((x) => r.local(x, now)).length;
      else {
        const res = await r.filter(s!.from(r.table).select("*", { count: "exact", head: true }) as never, now);
        count = (res as unknown as { count: number | null }).count ?? 0;
      }
    } catch {
      count = 0; // a table that isn't there yet
    }
    out.push({ key: r.key, label: r.label, count });
  }
  return out;
}

/** Removes the old records. Returns how many went. */
export async function cleanUp(): Promise<number> {
  const s = db();
  const now = new Date().toISOString();
  let removed = 0;
  if (!s) {
    const d = (await readLocal()) as unknown as Record<string, Record<string, unknown>[] | undefined>;
    for (const r of RULES) {
      const rows = d[r.table] ?? [];
      const keep = rows.filter((x) => !r.local(x, now));
      removed += rows.length - keep.length;
      d[r.table] = keep;
    }
    await writeLocal(d as never);
    return removed;
  }
  for (const r of RULES) {
    try {
      const res = await r.filter(s.from(r.table).delete({ count: "exact" }) as never, now);
      const { error, count } = res as unknown as { error: { message: string } | null; count: number | null };
      if (error) throw new Error(error.message);
      removed += count ?? 0;
    } catch (err) {
      console.error("clean-up failed for", r.table, err);
    }
  }
  return removed;
}
