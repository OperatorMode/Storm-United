import { createHash, randomInt, randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";
import { zonedTime } from "./fixtures";
import { DEFAULT_TZ, isoDateIn, minutesOfDay } from "./time";

// My Activities: a family's own activities (piano, ballet, school swimming,
// a sport that isn't on Sidelnr) shown with their team games. Parents have no
// account, so activities belong to a household: one per phone (its id is in a
// cookie), shareable with another phone through a short-lived code.
// Same pattern as store.ts: Supabase in production, a local JSON file in dev.

export type WeeklySlot = { d: number; t: string; m: number }; // weekday 0-6 (Sun-Sat), "16:30", minutes
export type ExtraSession = { at: string; m: number; n?: string; l?: string }; // ISO start, minutes, title, place

export type Activity = {
  id: string;
  household_id: string;
  person: string; // first name, or "Me"
  name: string;
  kind: string | null; // Sport, Music, Dance, School, Other
  location: string | null;
  tz: string;
  weekly: WeeklySlot[];
  starts_on: string | null; // yyyy-mm-dd
  ends_on: string | null;
  extra: ExtraSession[];
  cancelled: string[]; // ISO start times of cancelled sessions
  source_url: string | null;
  source_kind: "ics" | "web" | null;
  source_filter: string | null;
  synced_at: string | null;
  source_error: string | null;
  created_at: string;
};

/** One session of an activity, ready to show. */
export type ActivitySession = {
  activity: Activity;
  start: Date;
  minutes: number;
  title: string; // the activity's name, or an imported event's own title
  place: string | null;
  cancelled: boolean;
};

export const ACTIVITY_KINDS = ["Sport", "Music", "Dance", "School", "Other"] as const;
const SHARE_HOURS = 24;

// ---------- storage ----------

type HouseholdRow = { id: string; share_code_hash: string | null; share_expires_at: string | null; created_at: string };

export async function createHousehold(): Promise<string> {
  const row: HouseholdRow = { id: randomUUID(), share_code_hash: null, share_expires_at: null, created_at: new Date().toISOString() };
  const s = db();
  if (!s) {
    const d = await readLocal();
    (d.households ??= []).push(row);
    await writeLocal(d);
    return row.id;
  }
  check(await s.from("households").insert(row));
  return row.id;
}

export async function householdExists(id: string): Promise<boolean> {
  const s = db();
  if (!s) return ((await readLocal()).households ?? []).some((h) => h.id === id);
  return !!check(await s.from("households").select("id").eq("id", id).maybeSingle());
}

export async function listActivities(householdId: string): Promise<Activity[]> {
  try {
    const s = db();
    const rows = s
      ? (check(await s.from("activities").select("*").eq("household_id", householdId)) as Activity[])
      : ((await readLocal()).activities ?? []).filter((a) => a.household_id === householdId);
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch (e) {
    console.error("activities", e); // never break My Activities
    return [];
  }
}

export async function saveActivity(a: Activity): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.activities = [...(d.activities ?? []).filter((x) => x.id !== a.id), a];
    return writeLocal(d);
  }
  check(await s.from("activities").upsert(a, { onConflict: "id" }));
}

export async function deleteActivity(householdId: string, id: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.activities = (d.activities ?? []).filter((x) => !(x.household_id === householdId && x.id === id));
    return writeLocal(d);
  }
  check(await s.from("activities").delete().eq("household_id", householdId).eq("id", id));
}

export function newActivity(householdId: string, fields: Partial<Activity> & Pick<Activity, "person" | "name">): Activity {
  return {
    id: randomUUID(),
    household_id: householdId,
    kind: null,
    location: null,
    tz: DEFAULT_TZ,
    weekly: [],
    starts_on: null,
    ends_on: null,
    extra: [],
    cancelled: [],
    source_url: null,
    source_kind: null,
    source_filter: null,
    synced_at: null,
    source_error: null,
    created_at: new Date().toISOString(),
    ...fields,
  };
}

// ---------- sharing a household with another phone ----------

const hashCode = (code: string) => createHash("sha256").update(code.toUpperCase()).digest("hex");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

/** A new 6-character code that links another phone to this household for 24 hours. */
export async function newShareCode(householdId: string): Promise<string> {
  const code = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
  const patch = { share_code_hash: hashCode(code), share_expires_at: new Date(Date.now() + SHARE_HOURS * 3600_000).toISOString() };
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.households = (d.households ?? []).map((h) => (h.id === householdId ? { ...h, ...patch } : h));
    await writeLocal(d);
  } else check(await s.from("households").update(patch).eq("id", householdId));
  return code;
}

/** The household a share code belongs to (if it's still valid). */
export async function householdForCode(code: string): Promise<string | null> {
  const clean = code.replace(/[^a-z0-9]/gi, "");
  if (clean.length !== 6) return null;
  const s = db();
  const rows: HouseholdRow[] = s
    ? (check(await s.from("households").select("*").eq("share_code_hash", hashCode(clean))) as HouseholdRow[])
    : ((await readLocal()).households ?? []).filter((h) => h.share_code_hash === hashCode(clean));
  const h = rows.find((r) => r.share_expires_at && new Date(r.share_expires_at).getTime() > Date.now());
  return h?.id ?? null;
}

/** Moves a phone's activities into the household it's joining. */
export async function moveActivities(from: string, to: string): Promise<void> {
  for (const a of await listActivities(from)) await saveActivity({ ...a, household_id: to });
}

// ---------- sessions ----------

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** An activity's sessions between two moments (weekly ones expanded, plus one-off and imported ones). */
export function sessionsOf(a: Activity, from: Date, to: Date): ActivitySession[] {
  const out: ActivitySession[] = [];
  const cancelled = new Set(a.cancelled);
  const push = (start: Date, minutes: number, title?: string, place?: string) => {
    if (start.getTime() + minutes * 60_000 < from.getTime() || start > to) return;
    out.push({ activity: a, start, minutes, title: title || a.name, place: place || a.location, cancelled: cancelled.has(start.toISOString()) });
  };
  if (a.weekly.length) {
    let day = [a.starts_on, isoDateIn(from, a.tz)].filter(Boolean).sort().at(-1)!; // the later of the two
    const last = [a.ends_on ?? "9999-12-31", isoDateIn(to, a.tz)].sort()[0];
    for (let i = 0; i < 400 && day <= last; i++, day = addDays(day, 1)) {
      for (const slot of a.weekly) if (slot.d === weekday(day)) push(zonedTime(day, slot.t, a.tz), slot.m);
    }
  }
  for (const e of a.extra) push(new Date(e.at), e.m, e.n, e.l);
  return out.sort((x, y) => x.start.getTime() - y.start.getTime());
}

/** "Tue & Thu 4:30pm" style summary of the weekly times (for the list of activities). */
export function weeklySummary(a: Activity): string {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byTime = new Map<string, number[]>();
  for (const s of a.weekly) byTime.set(`${s.t}|${s.m}`, [...(byTime.get(`${s.t}|${s.m}`) ?? []), s.d]);
  return [...byTime.entries()]
    .map(([k, days]) => {
      const [t, m] = k.split("|");
      const [h, min] = t.split(":").map(Number);
      const time = `${((h + 11) % 12) + 1}${min ? `:${String(min).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
      const order = [1, 2, 3, 4, 5, 6, 0];
      return `${[...days].sort((x, y) => order.indexOf(x) - order.indexOf(y)).map((d) => DAYS[d]).join(" & ")} ${time} (${m} min)`;
    })
    .join(", ");
}

// ---------- importing from a calendar (.ics) ----------

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const IMPORT_DAYS_BACK = 14;
const IMPORT_DAYS_AHEAD = 366;
const MAX_SESSIONS = 600;

function icsStart(value: string, params: string, tz: string): { date: string; time: string; tz: string; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { date: `${y}-${mo}-${d}`, time: "00:00", tz, allDay: true };
  if (z) {
    const at = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    const mins = minutesOfDay(at, tz);
    return { date: isoDateIn(at, tz), time: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`, tz, allDay: false };
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, tz: params.match(/TZID=([^;:]+)/)?.[1] ?? tz, allDay: false };
}

const unescape = (s: string) => s.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

/** Sessions from a calendar file: one-off events and simple repeating ones (daily/weekly), from two weeks ago to a year ahead. */
export function sessionsFromIcs(text: string, tz: string, filter: string | null): ExtraSession[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const from = Date.now() - IMPORT_DAYS_BACK * 86_400_000;
  const to = Date.now() + IMPORT_DAYS_AHEAD * 86_400_000;
  const out: ExtraSession[] = [];
  const needle = filter?.trim().toLowerCase() || null;
  let ev: Record<string, { value: string; params: string }[]> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT" && ev) {
      const one = (k: string) => ev![k]?.[0];
      const title = unescape(one("SUMMARY")?.value ?? "");
      const place = unescape(one("LOCATION")?.value ?? "") || undefined;
      const start = one("DTSTART") ? icsStart(one("DTSTART")!.value, one("DTSTART")!.params, tz) : null;
      ev = (() => {
        if (!start || one("STATUS")?.value === "CANCELLED") return null;
        if (needle && !`${title} ${place ?? ""}`.toLowerCase().includes(needle)) return null;
        // Length: from DTEND or DURATION; all-day events count as the whole day.
        let minutes = 60;
        const end = one("DTEND") ? icsStart(one("DTEND")!.value, one("DTEND")!.params, tz) : null;
        if (start.allDay) minutes = 24 * 60;
        else if (end && !end.allDay) {
          const diff = (zonedTime(end.date, end.time, end.tz).getTime() - zonedTime(start.date, start.time, start.tz).getTime()) / 60_000;
          if (diff > 0 && diff <= 24 * 60) minutes = diff;
        } else {
          const dur = one("DURATION")?.value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
          if (dur) minutes = Number(dur[1] ?? 0) * 60 + Number(dur[2] ?? 0) || 60;
        }
        const skip = new Set(
          (ev!.EXDATE ?? []).flatMap((x) => x.value.split(",").map((v) => icsStart(v, x.params, tz)).filter((v) => v !== null).map((v) => v.date)),
        );
        const add = (date: string) => {
          if (skip.has(date) || out.length >= MAX_SESSIONS) return;
          const at = zonedTime(date, start.time, start.tz);
          if (at.getTime() >= from && at.getTime() <= to) out.push({ at: at.toISOString(), m: minutes, n: title || undefined, l: place });
        };
        const rule = Object.fromEntries((one("RRULE")?.value ?? "").split(";").filter(Boolean).map((p) => p.split("=") as [string, string]));
        if (rule.FREQ !== "WEEKLY" && rule.FREQ !== "DAILY") {
          add(start.date);
          return null;
        }
        // Simple repeats: every day or week (with INTERVAL, BYDAY, UNTIL or COUNT).
        const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
        const until = rule.UNTIL ? icsStart(rule.UNTIL, "", tz)?.date : null;
        const days = rule.FREQ === "WEEKLY" ? (rule.BYDAY ? rule.BYDAY.split(",").map((c) => DAY_CODES.indexOf(c.slice(-2))) : [weekday(start.date)]) : null;
        let count = Number(rule.COUNT ?? Infinity);
        const lastDate = isoDateIn(new Date(to), tz);
        for (let day = start.date, i = 0; day <= lastDate && count > 0 && (!until || day <= until) && i < 3000; day = addDays(day, 1), i++) {
          const daysSince = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${start.date}T12:00:00Z`)) / 86_400_000);
          const inStep = rule.FREQ === "DAILY" ? daysSince % interval === 0 : Math.floor(daysSince / 7) % interval === 0;
          if (!inStep || (days && !days.includes(weekday(day)))) continue;
          add(day);
          count--;
        }
        return null;
      })();
    } else if (ev) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
      if (m) (ev[m[1]] ??= []).push({ params: m[2], value: m[3] });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
