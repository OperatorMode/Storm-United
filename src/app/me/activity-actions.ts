"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ACTIVITY_KINDS,
  createHousehold,
  deleteActivity,
  householdExists,
  householdForCode,
  listActivities,
  moveActivities,
  newActivity,
  newShareCode,
  saveActivity,
  type WeeklySlot,
} from "@/lib/activities";
import { readActivitySource, refreshActivity } from "@/lib/activity-import";
import { parseDate, parseTime, zonedTime } from "@/lib/fixtures";
import { COOKIE_OPTS, HOUSEHOLD_COOKIE, currentHouseholdId } from "@/lib/session";
import { DEFAULT_TZ, isTimezone } from "@/lib/time";

// My Activities: a family's own activities, stored for this phone's household.

const MAX_ACTIVITIES = 40;

/** This phone's household, created on first use. */
async function household(): Promise<string> {
  const existing = await currentHouseholdId();
  if (existing && (await householdExists(existing))) return existing;
  const id = await createHousehold();
  (await cookies()).set(HOUSEHOLD_COOKIE, id, COOKIE_OPTS);
  return id;
}

const refresh = () => revalidatePath("/me");

export async function addActivity(_: unknown, formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const person = get("person").slice(0, 40);
  const name = get("name").slice(0, 60);
  const mode = get("mode");
  const tz = isTimezone(get("tz")) ? get("tz") : DEFAULT_TZ;
  if (!person) return { error: "Choose who it’s for." };
  if (!name) return { error: "Give the activity a name, e.g. Piano." };
  const id = await household();
  if ((await listActivities(id)).length >= MAX_ACTIVITIES) return { error: "That’s a lot of activities. Remove some first." };

  const base = newActivity(id, {
    person,
    name,
    kind: (ACTIVITY_KINDS as readonly string[]).includes(get("kind")) ? get("kind") : null,
    location: get("location").slice(0, 120) || null,
    tz,
  });

  if (mode === "import") {
    const url = get("url");
    if (!url) return { error: "Paste the calendar or web page link." };
    const filter = get("filter").slice(0, 60) || null;
    try {
      const res = await readActivitySource(url, tz, filter, name);
      await saveActivity({ ...base, extra: res.sessions, source_url: res.url, source_kind: res.kind, source_filter: filter, synced_at: new Date().toISOString() });
      refresh();
      return { ok: true, count: res.sessions.length };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn’t read that link." };
    }
  }

  const minutes = Math.round(Number(get("minutes")));
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 24 * 60) return { error: "How long does it go for (in minutes)?" };
  const time = parseTime(get("time"));
  if (!time) return { error: "Enter a start time, e.g. 4:30 pm." };

  if (mode === "once") {
    const date = parseDate(get("date"));
    if (!date) return { error: "Pick the date." };
    await saveActivity({ ...base, extra: [{ at: zonedTime(date, time, tz).toISOString(), m: minutes }] });
    refresh();
    return { ok: true, count: 1 };
  }

  // Weekly on the chosen days, from a start date until an optional end date.
  const days = formData.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!days.length) return { error: "Tick the day (or days) it’s on." };
  const startsOn = parseDate(get("starts_on"));
  const endsOn = get("ends_on") ? parseDate(get("ends_on")) : null;
  if (!startsOn) return { error: "Pick the date it starts." };
  if (get("ends_on") && !endsOn) return { error: "That end date doesn’t look right." };
  if (endsOn && endsOn < startsOn) return { error: "The end date is before the start." };
  const weekly: WeeklySlot[] = [...new Set(days)].map((d) => ({ d, t: time, m: minutes }));
  await saveActivity({ ...base, weekly, starts_on: startsOn, ends_on: endsOn });
  refresh();
  return { ok: true, count: weekly.length };
}

async function mine(activityId: string) {
  const id = await currentHouseholdId();
  if (!id) return null;
  return (await listActivities(id)).find((a) => a.id === activityId) ?? null;
}

export async function removeActivity(activityId: string) {
  const a = await mine(activityId);
  if (!a) return;
  await deleteActivity(a.household_id, a.id);
  refresh();
}

/** Cancels one session ("no lesson this week"), or brings it back. */
export async function toggleSession(activityId: string, startIso: string) {
  const a = await mine(activityId);
  if (!a || Number.isNaN(Date.parse(startIso))) return;
  const iso = new Date(startIso).toISOString();
  const cancelled = a.cancelled.includes(iso) ? a.cancelled.filter((c) => c !== iso) : [...a.cancelled, iso];
  await saveActivity({ ...a, cancelled: cancelled.slice(-200) });
  refresh();
}

export async function reimportActivity(activityId: string) {
  const a = await mine(activityId);
  if (!a?.source_url) return { error: "Not found." };
  const next = await refreshActivity(a);
  refresh();
  return next.source_error ? { error: next.source_error } : { ok: true, count: next.extra.length };
}

// ---------- sharing with another phone ----------

/** A code another phone can enter (within 24 hours) to see this phone's activities. */
export async function shareActivities() {
  const id = await household();
  return { code: await newShareCode(id) };
}

/** Joins the household of another phone; this phone's own activities move across. */
export async function joinActivities(code: string) {
  const target = await householdForCode(code);
  if (!target) return { error: "That code isn’t right or has expired. Ask for a new one." };
  const current = await currentHouseholdId();
  if (current === target) return { ok: true };
  if (current) await moveActivities(current, target);
  (await cookies()).set(HOUSEHOLD_COOKIE, target, COOKIE_OPTS);
  refresh();
  return { ok: true };
}
