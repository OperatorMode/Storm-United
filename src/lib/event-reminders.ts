import { listTeams } from "./store";
import { getTeam } from "./teams";
import { getPushSubs, markSent } from "./messages";
import { sendPush } from "./push";
import { isEvent, listRsvps } from "./my-events";
import { DEFAULT_TZ, formatTime, isoDateIn, minutesOfDay } from "./time";
import { EVENT_DUTY_GAME, listDutySignups } from "./duties";

// My Event reminders, checked every 15 minutes with the game alerts:
// - the day before the reply-by date, to families who haven't answered yet
// - the day before the event, and on the day (from 3 hours before), to families
//   going or maybe, or with a job (like the team game-day reminder, it says
//   which jobs are theirs: "Your job: Bring a salad.")
// Only phones that switched notifications on for the event get them.

const HOUR = 3600_000;

export async function sendEventReminders(now = new Date()): Promise<number> {
  let sent = 0;
  for (const row of await listTeams()) {
    if (!isEvent(row) || !row.event_starts_at) continue;
    const start = new Date(row.event_starts_at);
    if (start.getTime() < now.getTime()) continue;
    const tz = row.event_tz ?? DEFAULT_TZ;
    const local = minutesOfDay(now, tz);
    if (local < 7 * 60 || local >= 20 * 60) continue; // daytime only
    const subs = (await getPushSubs(row.id)).filter((s) => s.notify_reminders !== false);
    if (!subs.length) continue;
    const event = await getTeam(row.id);
    if (!event) continue;
    const [rsvps, signups] = await Promise.all([listRsvps(event.id), listDutySignups(event.id)]);
    const jobsOf = (guest: string) => signups.filter((d) => d.game_id === EVENT_DUTY_GAME && d.player_id === guest).map((d) => d.duty);
    const jobsLine = (guest: string) => {
      const jobs = jobsOf(guest);
      return jobs.length ? ` Your job${jobs.length === 1 ? "" : "s"}: ${jobs.join(", ")}.` : "";
    };
    // Going or maybe, or doing a job: they get the day-before and on-the-day reminders.
    const expected = (guest: string) => {
      const a = answer(guest);
      return (!!a && a.status !== "no") || jobsOf(guest).length > 0;
    };
    const answer = (guest: string) => rsvps.find((r) => r.guest_id === guest);
    const guestOf = (s: { children?: string | null }) => (s.children ?? "").split(",").filter(Boolean)[0];
    const tomorrow = isoDateIn(new Date(now.getTime() + 24 * HOUR), tz);
    const icon = `/${event.id}/icon/192`;
    const url = `/${event.id}`;

    if (local >= 9 * 60 && event.rsvp_by === tomorrow && (await markSent(event.id, `rsvp-by:${event.rsvp_by}`))) {
      for (const s of subs) {
        const g = guestOf(s);
        if (!g || answer(g)) continue;
        sent++;
        await sendPush(s, { title: `${event.name}: are you coming?`, body: "Please answer by tomorrow. Tap to say Going, Maybe or Can’t come.", url, icon, tag: `${event.id}-rsvp` }).catch(() => {});
      }
    }

    const until = start.getTime() - now.getTime();
    if (local >= 9 * 60 && until <= 28 * HOUR && until > 20 * HOUR && (await markSent(event.id, `day-before:${event.event_starts_at}`))) {
      for (const s of subs) {
        const g = guestOf(s) ?? "";
        if (!expected(g)) continue;
        sent++;
        await sendPush(s, {
          title: `Tomorrow: ${event.name}`,
          body: `${formatTime(start, tz)}${event.event_place ? `, ${event.event_place}` : ""}.${jobsLine(g)}`,
          url,
          icon,
          tag: `${event.id}-day`,
        }).catch(() => {});
      }
    }

    // On the day: from 3 hours before it starts.
    if (until <= 3 * HOUR && until > 15 * 60_000 && (await markSent(event.id, `today:${event.event_starts_at}`))) {
      for (const s of subs) {
        const g = guestOf(s) ?? "";
        if (!expected(g)) continue;
        sent++;
        await sendPush(s, {
          title: `Today: ${event.name}`,
          body: `Starts ${formatTime(start, tz)}${event.event_place ? ` at ${event.event_place}` : ""}.${jobsLine(g)}`,
          url,
          icon,
          tag: `${event.id}-today`,
        }).catch(() => {});
      }
    }
  }
  return sent;
}
