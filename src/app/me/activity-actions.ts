"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  ACTIVITY_KINDS,
  createHousehold,
  deleteActivity,
  householdExists,
  listActivities,
  moveActivities,
  newActivity,
  newShareCode,
  saveActivity,
  redeemCode,
  showCode,
  linkActivities,
  newActivityShareCode,
  unlinkActivity,
  hideActivity,
  weeklySummary,
  type Activity,
  type WeeklySlot,
  leaveSharedDate,
  sharedWith,
} from "@/lib/activities";
import { readActivitySource, refreshActivity } from "@/lib/activity-import";
import { deleteHouseholdPush, getHouseholdPush, notifyClashSorted, notifyNewActivity, saveHouseholdPush } from "@/lib/activity-reminders";
import { after } from "next/server";
import { parseDate, parseTime, zonedTime } from "@/lib/fixtures";
import { COOKIE_OPTS, HOUSEHOLD_COOKIE, currentDeviceId, currentHouseholdId } from "@/lib/session";
import { ensureDeviceId } from "@/lib/device";
import { DEFAULT_TZ, isTimezone } from "@/lib/time";
import { lockedMessage, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { TAKER_MAX, listTakers, setTaker } from "@/lib/takers";
import { getDeviceName } from "@/lib/profile";
import { formatTime, formatWeekday } from "@/lib/time";

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

/** This phone's private id, created on first use. */
const device = ensureDeviceId;

const refresh = () => revalidatePath("/me");

/** After adding (not editing) an activity: tell the household's other phones. */
function announce(a: Activity, isNew: boolean, endpoint: string) {
  if (!isNew) return;
  const summary = a.source_url
    ? `${a.extra.length} session${a.extra.length === 1 ? "" : "s"} from a link`
    : a.weekly.length
      ? weeklySummary(a)
      : "One session";
  after(() => notifyNewActivity(a.household_id, a, summary, endpoint || null));
}

/** Adds an activity, or saves changes to one (when the form carries its id). */
export async function addActivity(_: unknown, formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const person = get("person").slice(0, 40);
  const name = get("name").slice(0, 60);
  const mode = get("mode");
  const tz = isTimezone(get("tz")) ? get("tz") : DEFAULT_TZ;
  if (!person) return { error: "Choose who it’s for." };
  if (!name) return { error: "Give the activity a name, e.g. Piano." };
  const id = await household();
  const endpoint = get("endpoint"); // this phone's push address: it isn't told about its own addition
  const store = async (a: Activity) => {
    await saveActivity(a);
    announce(a, !existing, endpoint);
  };
  const existing = get("id") ? await mine(get("id")) : null;
  if (get("id") && !existing) return { error: "That activity isn’t on this phone any more." };
  if (!existing && (await listActivities(id)).length >= MAX_ACTIVITIES) return { error: "That’s a lot of activities. Remove some first." };

  // Editing keeps the activity (its id, sharing and cancelled sessions) and
  // replaces what it is and when it's on.
  const base = existing
    ? {
        ...existing,
        person,
        name,
        location: get("location").slice(0, 120) || null,
        weekly: [],
        starts_on: null,
        ends_on: null,
        extra: [],
        source_url: null,
        source_kind: null,
        source_filter: null,
        source_error: null,
      }
    : newActivity(id, {
        person,
        name,
        kind: (ACTIVITY_KINDS as readonly string[]).includes(get("kind")) ? get("kind") : null,
        location: get("location").slice(0, 120) || null,
        tz,
        created_by_device: await device(),
      });

  if (mode === "import") {
    const url = get("url");
    if (!url) return { error: "Paste the calendar or web page link." };
    const filter = get("filter").slice(0, 60) || null;
    // Same link and filter as before: keep the sessions already read.
    if (existing?.source_url && existing.source_url === url && (existing.source_filter ?? null) === filter) {
      await store({ ...base, extra: existing.extra, source_url: url, source_kind: existing.source_kind, source_filter: filter, synced_at: existing.synced_at });
      refresh();
      return { ok: true, count: existing.extra.length };
    }
    try {
      const res = await readActivitySource(url, base.tz, filter, name);
      await store({ ...base, extra: res.sessions, source_url: res.url, source_kind: res.kind, source_filter: filter, synced_at: new Date().toISOString() });
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
    await store({ ...base, extra: [{ at: zonedTime(date, time, base.tz).toISOString(), m: minutes }] });
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
  await store({ ...base, weekly, starts_on: startsOn, ends_on: endsOn });
  refresh();
  return { ok: true, count: weekly.length };
}

async function mine(activityId: string) {
  const id = await currentHouseholdId();
  if (!id) return null;
  return (await listActivities(id, await currentDeviceId())).find((a) => a.id === activityId) ?? null;
}

/**
 * Removes an activity from this phone. Only the phone that created it can
 * delete it for everyone it's shared with (`everywhere`); anyone else's
 * Remove just takes it off their own phone.
 */
export async function removeActivity(activityId: string, everywhere = false) {
  const a = await mine(activityId);
  if (!a) return;
  if (a.linked) await unlinkActivity((await currentHouseholdId())!, a.id); // shared with this phone by code
  else if (everywhere && a.mine) await deleteActivity(a.household_id, a.id);
  else await hideActivity(await device(), a.id);
  refresh();
}

/** Cancels one session ("no lesson this week"), or brings it back. */
export async function toggleSession(activityId: string, startIso: string) {
  const a = await mine(activityId);
  if (!a || a.linked || Number.isNaN(Date.parse(startIso))) return; // a shared event is left, not skipped
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

/**
 * A code another phone can enter (within 24 hours): for all of this phone's
 * activities (both phones then share everything, including ones added later),
 * or just the chosen ones.
 */
export async function shareActivities(activityIds: string[] | null) {
  const id = await household();
  const own = (await listActivities(id)).filter((a) => !a.linked).map((a) => a.id);
  const chosen = activityIds ? activityIds.filter((x) => own.includes(x)) : null;
  if (chosen && !chosen.length) return { error: "Tick at least one activity." };
  try {
    if (!chosen || chosen.length === own.length) return { code: showCode(await newShareCode(id)), all: true };
    return { code: showCode(await newActivityShareCode(id, chosen)), all: false };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn’t make a code." };
  }
}

/** Share an event (not the family): one activity, every time, or just one date (ISO start). */
export async function shareEvent(activityId: string, onlyAt: string | null) {
  const id = await household();
  const a = (await listActivities(id)).find((x) => x.id === activityId && !x.linked);
  if (!a) return { error: "Pick one of your own events." };
  if (onlyAt && Number.isNaN(Date.parse(onlyAt))) return { error: "Pick a date." };
  try {
    return { code: showCode(await newActivityShareCode(id, [a.id], onlyAt ? [new Date(onlyAt).toISOString()] : null)) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn’t make a code." };
  }
}

/** Joins the household of another phone; this phone's own activities move across. */
export async function joinActivities(code: string) {
  // The code is used up here: nobody else can use it after this.
  const locked = await lockedMessage("share", "activities");
  if (locked) return { error: locked };
  const shared = await redeemCode(code);
  if (!shared) {
    await recordFailure("share", "activities");
    return { error: "That code isn’t right, has expired or has already been used. Ask for a new one." };
  }
  await recordSuccess("share", "activities");
  if ("activityIds" in shared) {
    // A shared event: it's added to this family (marked Shared), nobody joins anyone's family.
    await linkActivities(await household(), shared.activityIds, shared.onlyAt, await getDeviceName(await device()));
    refresh();
    return { ok: true, kind: "event" as const, count: shared.activityIds.length };
  }
  const current = await currentHouseholdId();
  if (current !== shared.household) {
    if (current) await moveActivities(current, shared.household);
    (await cookies()).set(HOUSEHOLD_COOKIE, shared.household, COOKIE_OPTS);
  }
  refresh();
  return { ok: true, kind: "family" as const };
}

/** This phone leaves its family's activities: a fresh, empty household; its reminders here stop. */
export async function leaveFamily(endpoint: string | null) {
  const id = await createHousehold();
  (await cookies()).set(HOUSEHOLD_COOKIE, id, COOKIE_OPTS);
  if (endpoint) await deleteHouseholdPush(endpoint);
  refresh();
  return { ok: true };
}

// ---------- reminders ----------

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** This phone's reminder switches (a day before, an hour before). */
export async function saveActivityReminders(sub: BrowserSubscription, prefs: { day: boolean; hour: boolean; news: boolean }) {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Invalid subscription." };
  if (!prefs.day && !prefs.hour && !prefs.news) {
    await deleteHouseholdPush(sub.endpoint);
    return { ok: true };
  }
  const id = await household();
  const existing = await getHouseholdPush(sub.endpoint);
  await saveHouseholdPush({
    endpoint: sub.endpoint,
    household_id: id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    remind_day: prefs.day,
    remind_hour: prefs.hour,
    notify_new: prefs.news,
    device_id: await device(),
    created_at: existing?.created_at ?? new Date().toISOString(),
  });
  return { ok: true };
}

export async function getActivityReminders(endpoint: string): Promise<{ day: boolean; hour: boolean; news: boolean } | null> {
  const id = await currentHouseholdId();
  const row = id ? await getHouseholdPush(endpoint) : null;
  return row && row.household_id === id ? { day: row.remind_day, hour: row.remind_hour, news: row.notify_new ?? true } : null;
}

/** Clash solver: who's taking a child to a game, training or activity (null clears it). */
export async function setClashTaker(entryKey: string, taker: string | null, activityId: string | null = null) {
  const key = entryKey.slice(0, 200);
  const who = taker?.replace(/\s+/g, " ").trim().slice(0, TAKER_MAX) || null;
  // A shared event: who's taking is one answer for everyone, kept by the family that shared it.
  const shared = activityId ? await mine(activityId) : null;
  await setTaker(shared?.linked ? shared.household_id : await household(), key, who);
  refresh();
  return { ok: true };
}

/** A clash was sorted on this phone: tell the family's other phones ("John takes Leo to Riverside Rockets game, Sat 7 Nov 8:30 am."). */
export async function tellFamilyClashSorted(text: string, activityId: string | null = null) {
  const id = await currentHouseholdId();
  const msg = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!id || !msg) return;
  const me = await currentDeviceId();
  const families = await familiesOf(id, activityId);
  after(() => notifyClashSorted(families, msg, me));
}

/** This family, plus (for a shared event) the family that shared it and everyone it's shared with. */
async function familiesOf(householdId: string, activityId: string | null): Promise<string[]> {
  const a = activityId ? await mine(activityId) : null;
  if (!a) return [householdId];
  return [...new Set([householdId, a.household_id, ...(await sharedWith([a.id])).map((l) => l.household_id)])];
}

/**
 * Leave a shared event: one date (`iso`), or every time. Only for this family;
 * the family that shared it keeps it. If the person leaving was taking a child
 * on those dates, that's undone, the clash shows again, and both families hear.
 */
export async function leaveSharedEvent(activityId: string, iso: string | null) {
  const id = await currentHouseholdId();
  const a = id ? await mine(activityId) : null;
  if (!id || !a?.linked) return { error: "Not a shared event." };
  if (iso && Number.isNaN(Date.parse(iso))) return { error: "Invalid date." };
  const at = iso ? new Date(iso).toISOString() : null;
  const families = await familiesOf(id, a.id); // before leaving: afterwards this family no longer has it
  if (at) await leaveSharedDate(id, a.id, at);
  else await unlinkActivity(id, a.id);
  // Was this person taking them? Then nobody is now.
  const me = await currentDeviceId();
  const name = (await getDeviceName(me))?.toLowerCase();
  if (name) {
    const takers = await listTakers(a.household_id);
    const now = Date.now();
    const freed = Object.entries(takers).filter(([key, who]) => {
      if (who.toLowerCase() !== name || !key.startsWith(`${a.id}-`)) return false;
      const start = key.slice(a.id.length + 1);
      return at ? start === at : Date.parse(start) > now;
    });
    for (const [key] of freed) await setTaker(a.household_id, key, null);
    if (freed.length) {
      const first = new Date(freed[0][0].slice(a.id.length + 1));
      const when = freed.length === 1 ? `${formatWeekday(first, a.tz)} ${formatTime(first, a.tz)}` : `${freed.length} dates`;
      const msg = `${await getDeviceName(me)} can’t take ${a.person === "Me" ? "them" : a.person} to ${a.name} (${when}) any more.`;
      after(() => notifyClashSorted(families, msg, me, "Clash open again"));
    }
  }
  refresh();
  return { ok: true };
}
