import { gamePlace, getLeagueData, meetingTime, opponent, pitchLabel, type Game } from "./league";
import { getGameSnapshot, getPushSubs, markSent, saveGameSnapshot } from "./messages";
import { sendPush } from "./push";
import { getAttendance, type GameSnapshot, type PushSubRow } from "./store";
import { firstName, playerName, type Team } from "./teams";
import { formatDay, formatTime, minutesOfDay } from "./time";
import { listDutySignups } from "./duties";

// Game alerts, checked every 15 minutes by a scheduled job (api/cron/game-alerts):
// - a game's time or pitch changed, it was postponed, or it disappeared (cancelled)
// - "Can Brooklyn play Saturday?" about two days before, to phones that haven't answered
// - match day: meeting time and venue a few hours before
// Works the same for every fixture source, because it compares what the team
// page would show now with what it showed at the last check.

const HOUR = 60 * 60 * 1000;
const HORIZON = 30 * 24 * HOUR; // only games in the next 30 days are watched

const wants = (s: PushSubRow, kind: "games" | "reminders") => (kind === "games" ? s.notify_games : s.notify_reminders) !== false;
const kidsOf = (s: PushSubRow) => (s.children ?? "").split(",").filter(Boolean);
const names = (list: string[]) => (list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`);

export async function checkTeam(team: Team, now = new Date()): Promise<{ changes: number; reminders: number }> {
  const subs = await getPushSubs(team.id);
  if (!subs.length) return { changes: 0, reminders: 0 };

  const { competition, tz, ourGames } = await getLeagueData(team);
  const t = now.getTime();
  const us = team.league_name;
  const upcoming = ourGames.filter((g) => g.kickoff.getTime() > t && g.kickoff.getTime() < t + HORIZON);
  const icon = `/${team.id}/icon/192`;
  const url = `/${team.id}`;
  const vs = (g: Pick<Game, "home">, opp: string) => `${g.home === us ? "vs" : "@"} ${opp}`;

  // ---- changes since the last check ----
  const snapshot: GameSnapshot = Object.fromEntries(
    upcoming.map((g) => [g.id, { k: g.kickoff.toISOString(), p: g.pitch, t: g.time === "Postponed" ? "P" : "", o: vs(g, opponent(g, us)) }]),
  );
  const previous = await getGameSnapshot(team.id);
  const changes: { id: string; text: string }[] = [];
  if (previous) {
    const watched = Object.entries(previous).filter(([, was]) => new Date(was.k).getTime() > t);
    const vanished = watched.filter(([id]) => !ourGames.some((g) => g.id === id));
    // Everything vanishing at once is a feed hiccup (keep the old picture and
    // say nothing) or a whole new draw, e.g. a new season (start afresh).
    const allGone = watched.length > 0 && vanished.length === watched.length;
    if (allGone && !upcoming.length) return { changes: 0, reminders: 0 };
    for (const [id, was] of watched) {
      const game = ourGames.find((g) => g.id === id);
      const when = `${formatDay(new Date(was.k), tz)}, ${formatTime(new Date(was.k), tz)}`;
      if (!game) {
        if (!allGone && vanished.length <= Math.max(2, watched.length / 2)) changes.push({ id, text: `Cancelled: ${when} ${was.o} is off.` });
        continue;
      }
      const day = formatDay(game.kickoff, tz);
      if (game.time === "Postponed" && was.t !== "P") changes.push({ id, text: `Postponed: ${when} ${was.o}.` });
      else if (game.kickoff.toISOString() !== was.k) {
        changes.push({ id, text: `New time: ${was.o} is now ${day}, ${formatTime(game.kickoff, tz)} (was ${when}).` });
      }
      if (game.pitch && was.p && game.pitch !== was.p) changes.push({ id, text: `Pitch change: ${day} ${was.o} is now on ${pitchLabel(game.pitch)} (was ${pitchLabel(was.p)}).` });
    }
  }
  if (!previous || JSON.stringify(previous) !== JSON.stringify(snapshot)) await saveGameSnapshot(team.id, snapshot);

  const gameSubs = subs.filter((s) => wants(s, "games"));
  for (const c of changes) {
    await Promise.allSettled(gameSubs.map((s) => sendPush(s, { title: `${team.name}: game change`, body: c.text, url, icon, tag: `${team.id}-game-${c.id}` })));
  }

  // ---- reminders ----
  const reminderSubs = subs.filter((s) => wants(s, "reminders"));
  let reminders = 0;
  if (reminderSubs.length) {
    const [attendance, dutySignups] = await Promise.all([getAttendance(team.id), listDutySignups(team.id)]);
    const statusOf = (gameId: string, child: string) => attendance.find((a) => a.game_id === gameId && a.player_id === child)?.status ?? null;
    const localMinutes = minutesOfDay(now, tz);
    for (const g of upcoming) {
      if (g.time === "Postponed") continue;
      const until = g.kickoff.getTime() - t;
      const opp = vs(g, opponent(g, us));

      // "Can … play?" between 48h and 20h before, in daytime.
      if (until <= 48 * HOUR && until > 20 * HOUR && localMinutes >= 8 * 60 && localMinutes < 20 * 60 && (await markSent(team.id, `ask:${g.id}`))) {
        const when = `${formatDay(g.kickoff, tz)}, ${formatTime(g.kickoff, tz)}`;
        await Promise.allSettled(
          reminderSubs.map((s) => {
            const kids = kidsOf(s);
            const open = kids.filter((k) => !statusOf(g.id, k));
            if (kids.length && !open.length) return null; // already answered
            const who = open.length ? names(open.map((k) => firstName(playerName(team, k)))) : "your child";
            reminders++;
            return sendPush(s, { title: `${team.name}: can ${who} play?`, body: `${when} ${opp}. Tap to answer.`, url, icon, tag: `${team.id}-ask-${g.id}` });
          }),
        );
      }

      // Match day: from 3 hours before meeting time (not before 7am).
      const meetAt = g.kickoff.getTime() - team.meet_minutes * 60_000;
      if (t >= meetAt - 3 * HOUR && until > 15 * 60_000 && localMinutes >= 7 * 60 && (await markSent(team.id, `day:${g.id}`))) {
        const place = [gamePlace(g.pitch, competition), g.pitch && /^[a-z]?\d+[a-z]?$/i.test(g.pitch) ? `Pitch ${g.pitch}` : null].filter(Boolean).join(", ");
        const meet = team.meet_minutes > 0 ? ` Meet ${meetingTime(g, team.meet_minutes, tz)}` : "";
        await Promise.allSettled(
          reminderSubs.map((s) => {
            const kids = kidsOf(s);
            const jobs = dutySignups.filter((d) => d.game_id === g.id && kids.includes(d.player_id)).map((d) => d.duty);
            if (kids.length && kids.every((k) => statusOf(g.id, k) === "no") && !jobs.length) return null; // not playing today
            reminders++;
            return sendPush(s, {
              title: `Game day: ${team.name} ${opp}`,
              body: `Kick-off ${formatTime(g.kickoff, tz)}.${meet}${place ? ` at ${place}` : ""}.${jobs.length ? ` You’re on: ${jobs.join(", ")}.` : ""}`,
              url,
              icon,
              tag: `${team.id}-day-${g.id}`,
            });
          }),
        );
      }
    }
  }
  return { changes: changes.length, reminders };
}
