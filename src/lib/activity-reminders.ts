import { check, db, readLocal, writeLocal } from "./store";
import { listActivities, sessionsOf, type ActivitySession } from "./activities";
import { sendPushTo } from "./push";
import { formatTime } from "./time";

// Reminders for family activities: "Tomorrow: Zane's Piano at 4:30 pm" about a
// day before, and "In 1 hour: …" an hour before. Each phone turns either on or
// off. Run by the 15-minute cron (api/cron/game-alerts); each reminder goes
// out once (activity_reminder_log).

export type HouseholdPush = {
  endpoint: string;
  household_id: string;
  p256dh: string;
  auth: string;
  remind_day: boolean;
  remind_hour: boolean;
  created_at: string;
};

const HOUR = 3600_000;
// A reminder is sent in the first cron run inside its window (runs every 15 minutes).
const DAY_WINDOW: [number, number] = [24 * HOUR, 23 * HOUR]; // between 24h and 23h before
const HOUR_WINDOW: [number, number] = [60 * 60_000, 30 * 60_000]; // between 60 and 30 minutes before

// ---------- storage ----------

export async function getHouseholdPush(endpoint: string): Promise<HouseholdPush | null> {
  const s = db();
  if (!s) return ((await readLocal()).household_push ?? []).find((p) => p.endpoint === endpoint) ?? null;
  return check(await s.from("household_push").select("*").eq("endpoint", endpoint).maybeSingle()) as HouseholdPush | null;
}

export async function saveHouseholdPush(row: HouseholdPush): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.household_push = [...(d.household_push ?? []).filter((p) => p.endpoint !== row.endpoint), row];
    return writeLocal(d);
  }
  check(await s.from("household_push").upsert(row, { onConflict: "endpoint" }));
}

export async function deleteHouseholdPush(endpoint: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.household_push = (d.household_push ?? []).filter((p) => p.endpoint !== endpoint);
    return writeLocal(d);
  }
  check(await s.from("household_push").delete().eq("endpoint", endpoint));
}

async function allHouseholdPush(): Promise<HouseholdPush[]> {
  const s = db();
  if (!s) return (await readLocal()).household_push ?? [];
  return check(await s.from("household_push").select("*")) as HouseholdPush[];
}

/** Records a reminder as sent; false if it already was. */
async function markSent(householdId: string, key: string): Promise<boolean> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    if ((d.activity_reminder_log ?? []).some((x) => x.household_id === householdId && x.key === key)) return false;
    (d.activity_reminder_log ??= []).push({ household_id: householdId, key, sent_at: new Date().toISOString() });
    await writeLocal(d);
    return true;
  }
  const res = await s.from("activity_reminder_log").insert({ household_id: householdId, key });
  if (res.error?.code === "23505") return false;
  check(res);
  return true;
}

// ---------- sending ----------

const who = (s: ActivitySession) => (s.activity.person === "Me" ? "" : `${s.activity.person}’s `);

/** Sends the reminders that are due now. Returns how many went out. */
export async function sendActivityReminders(now = Date.now()): Promise<number> {
  const subs = await allHouseholdPush();
  const byHousehold = new Map<string, HouseholdPush[]>();
  for (const p of subs) byHousehold.set(p.household_id, [...(byHousehold.get(p.household_id) ?? []), p]);
  let sent = 0;

  for (const [householdId, phones] of byHousehold) {
    const sessions = (await listActivities(householdId))
      .flatMap((a) => sessionsOf(a, new Date(now), new Date(now + 25 * HOUR)))
      .filter((s) => !s.cancelled);
    for (const s of sessions) {
      const until = s.start.getTime() - now;
      const allDay = s.minutes >= 24 * 60;
      const kinds: { kind: "day" | "hour"; window: [number, number] }[] = [
        { kind: "day", window: DAY_WINDOW },
        ...(allDay ? [] : [{ kind: "hour" as const, window: HOUR_WINDOW }]),
      ];
      for (const { kind, window } of kinds) {
        if (until > window[0] || until <= window[1]) continue;
        const targets = phones.filter((p) => (kind === "day" ? p.remind_day : p.remind_hour));
        if (!targets.length) continue;
        if (!(await markSent(householdId, `${kind}:${s.activity.id}:${s.start.toISOString()}`))) continue;
        const time = allDay ? "" : ` at ${formatTime(s.start, s.activity.tz)}`;
        const payload = {
          title: kind === "day" ? `Tomorrow: ${who(s)}${s.title}` : `In 1 hour: ${who(s)}${s.title}`,
          body: [`${s.title}${time}`, s.place].filter(Boolean).join(" · "),
          url: "/me",
          icon: "/app-icon/192",
          tag: `activity-${s.activity.id}-${kind}`,
        };
        await Promise.allSettled(targets.map((p) => sendPushTo(p, payload, () => deleteHouseholdPush(p.endpoint))));
        sent++;
      }
    }
  }
  return sent;
}
