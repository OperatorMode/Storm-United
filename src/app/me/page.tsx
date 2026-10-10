import type { Metadata } from "next";
import Link from "next/link";
import { getTeam, firstName, playerName, type Team } from "@/lib/teams";
import { canView, currentChildren } from "@/lib/session";
import { knownTeamIds } from "@/lib/known-teams";
import { gamePlace, getLeagueData, meetingTime, opponent, ourScore, pitchLabel, roundLabel, type Game } from "@/lib/league";
import { getAttendance, type AttendanceStatus } from "@/lib/store";
import { formatTime, formatWeekday, isoDateIn, minutesOfDay } from "@/lib/time";
import { logoSrc } from "@/lib/brand";
import { now as clockNow } from "@/lib/clock";
import { Directions } from "@/components/Directions";
import { AddToCalendar } from "@/components/AddToCalendar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { listTraining } from "@/lib/training";
import { listDutySignups } from "@/lib/duties";
import { LegalLinks } from "@/components/LegalPage";
import { ForgetPhone } from "./ForgetPhone";
import { MyPlayerViews } from "./MyPlayerViews";
import { KidColours } from "./KidColours";
import { kidKey } from "@/lib/kid-key";
import { calendarToken } from "@/lib/calendar";
import { headers } from "next/headers";
import { after } from "next/server";
import { currentHouseholdId } from "@/lib/session";
import { listActivities, sessionsOf, weeklySummary, type Activity } from "@/lib/activities";
import type { ActivityInitial } from "./ActivityForm";
import { needsRefresh, refreshActivity } from "@/lib/activity-import";
import { ActivityForm } from "./ActivityForm";
import { ActivityList, JoinCode, SessionToggle, ShareActivities } from "./ActivitiesManage";
import { ActivityReminders } from "./ActivityReminders";
import { pushPublicKey } from "@/lib/push";

// My Activities: every game, training and duty for every team this phone
// follows, plus the family's own activities (music, dance, school...), in one
// list: when, where (with directions), meeting time and whether you've said
// your child can play. For families with more than one child or activity.

export const metadata: Metadata = { title: "My Activities · Sidelnr", robots: { index: false } };

// Importing an activity from a web page can take a minute.
export const maxDuration = 300;

const ACTIVITY_DAYS_AHEAD = 120;

const STATUS: Record<AttendanceStatus, { label: string; cls: string }> = {
  yes: { label: "Can play", cls: "bg-emerald-50 text-emerald-800" },
  maybe: { label: "Maybe", cls: "bg-amber-50 text-amber-800" },
  no: { label: "Can't make it", cls: "bg-zinc-100 text-zinc-500" },
};
const GAME_WINDOW_MS = 90 * 60 * 1000; // a game stays "upcoming" until ~1.5h after kick-off

type Entry = {
  team: Team | null; // null: a family activity
  activity?: { id: string; name: string; kind: string | null; start: string; minutes: number; cancelled: boolean };
  game: Game;
  tz: string;
  place: string | null;
  kids: { name: string; status: AttendanceStatus | null }[];
  clashes: { kind: "child" | "family"; text: string }[];
  training?: { cancelled: boolean; minutes: number; note: string | null };
  duties?: string[]; // jobs this family is on for the game (oranges, snacks…)
};

const BUSY_AFTER_MS = 60 * 60 * 1000; // a game keeps you busy until ~1h after kick-off

/** From meeting time until an hour after kick-off. */
const busy = (e: Entry): [number, number] => {
  const k = e.game.kickoff.getTime();
  if (e.activity) return [k, k + e.activity.minutes * 60_000];
  if (e.training) return [k, k + e.training.minutes * 60_000];
  return [k - (e.team?.meet_minutes ?? 0) * 60_000, k + BUSY_AFTER_MS];
};

/**
 * Overlapping games: the same child (matched by first name across teams) in
 * two games at once, or different kids playing at the same time at different
 * venues (a parent can't be at both).
 */
function findClashes(entries: Entry[]): { child: number; family: number } {
  const count = { child: 0, family: 0 };
  const live = entries.filter((e) => e.game.time !== "Postponed");
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const [a0, a1] = busy(a);
      const [b0, b1] = busy(b);
      if (a0 >= b1 || b0 >= a1) continue;
      const names = (e: Entry) => e.kids.map((k) => k.name.toLowerCase());
      const shared = a.kids.filter((k) => names(b).includes(k.name.toLowerCase())).map((k) => k.name);
      const other = (y: Entry) =>
        y.activity || !y.team
          ? `${y.activity?.name ?? "an activity"} at ${formatTime(y.game.kickoff, y.tz)}`
          : y.training
            ? `${y.team.name} training at ${formatTime(y.game.kickoff, y.tz)}`
            : `${y.team.name} ${y.game.home === y.team.league_name ? "vs" : "@"} ${opponent(y.game, y.team.league_name)} at ${formatTime(y.game.kickoff, y.tz)}`;
      if (shared.length) {
        const who = shared.join(" & ");
        a.clashes.push({ kind: "child", text: `${who} ${shared.length > 1 ? "have" : "has"} something else at the same time: ${other(b)}.` });
        b.clashes.push({ kind: "child", text: `${who} ${shared.length > 1 ? "have" : "has"} something else at the same time: ${other(a)}.` });
        count.child++;
      } else if (a.kids.length && b.kids.length && a.place !== b.place) {
        a.clashes.push({ kind: "family", text: `Same time as ${other(b)}, at a different venue.` });
        b.clashes.push({ kind: "family", text: `Same time as ${other(a)}, at a different venue.` });
        count.family++;
      }
    }
  }
  return count;
}

export default async function MyPlayerPage({ searchParams }: PageProps<"/me">) {
  // An invitation link (/me?join=ABCD-EFGH): the code is shown ready to add.
  const join = (await searchParams).join;
  const joinCode = typeof join === "string" ? join.slice(0, 12) : "";
  const ids = await knownTeamIds();
  const teams = (await Promise.all(ids.map((id) => getTeam(id)))).filter((t): t is Team => t !== null);
  const now = clockNow().getTime();

  const perTeam = await Promise.all(
    teams.map(async (team) => {
      if (!(await canView(team))) return [];
      const [{ competition, tz, ourGames }, children, attendance, dutySignups] = await Promise.all([
        getLeagueData(team),
        currentChildren(team),
        getAttendance(team.id),
        listDutySignups(team.id),
      ]);
      const kidsFor = (id: string) =>
        children.map((c) => ({
          name: firstName(playerName(team, c)),
          status: attendance.find((a) => a.game_id === id && a.player_id === c)?.status ?? null,
        }));
      // Training sessions appear alongside games (and count for clashes).
      const sessions = (await listTraining(team.id)).map(
        (t): Entry => ({
          team,
          game: {
            id: t.id,
            round: null,
            time: t.cancelled ? "Postponed" : formatTime(new Date(t.starts_at), tz),
            pitch: null,
            stage: "Training",
            home: team.league_name,
            away: "",
            kickoff: new Date(t.starts_at),
            score: null,
            scoreSource: null,
          },
          tz,
          place: t.location,
          clashes: [],
          kids: kidsFor(t.id),
          training: { cancelled: t.cancelled, minutes: t.minutes, note: t.note },
        }),
      );
      return [...sessions, ...ourGames.map(
        (game): Entry => ({
          team,
          game,
          tz,
          place: gamePlace(game.pitch, competition),
          clashes: [],
          kids: kidsFor(game.id),
          duties: dutySignups.filter((d) => d.game_id === game.id && children.includes(d.player_id)).map((d) => d.duty),
        }),
      )];
    }),
  );
  // The family's own activities, from a couple of hours ago to four months ahead.
  const householdId = await currentHouseholdId();
  const activities = householdId ? await listActivities(householdId) : [];
  const stale = activities.filter(needsRefresh);
  if (stale.length) after(() => Promise.allSettled(stale.map(refreshActivity)).then(() => undefined));
  const activityEntries = activities.flatMap((a) =>
    sessionsOf(a, new Date(now - 2 * 3600_000), new Date(now + ACTIVITY_DAYS_AHEAD * 86_400_000)).map(
      (s): Entry => ({
        team: null,
        activity: { id: a.id, name: s.title, kind: a.kind, start: s.start.toISOString(), minutes: s.minutes, cancelled: s.cancelled },
        game: {
          id: `${a.id}-${s.start.toISOString()}`,
          round: null,
          time: s.cancelled ? "Postponed" : formatTime(s.start, a.tz),
          pitch: null,
          stage: "Activity",
          home: "",
          away: "",
          kickoff: s.start,
          score: null,
          scoreSource: null,
        },
        tz: a.tz,
        place: s.place,
        kids: [{ name: a.person, status: null }],
        clashes: [],
      }),
    ),
  );
  const all = [...perTeam.flat(), ...activityEntries];
  const upcoming = all.filter((e) => e.game.kickoff.getTime() + GAME_WINDOW_MS > now).sort((a, b) => a.game.kickoff.getTime() - b.game.kickoff.getTime());
  const results = all
    .filter((e): e is Entry & { team: Team } => !!e.team && e.game.kickoff.getTime() + GAME_WINDOW_MS <= now && !!e.game.score)
    .sort((a, b) => b.game.kickoff.getTime() - a.game.kickoff.getTime())
    .slice(0, 6);

  const { child: childClashes, family: familyClashes } = findClashes(upcoming);

  const [calToken, host] = await Promise.all([calendarToken(teams, activities.length ? householdId : null), headers().then((h) => h.get("host") ?? "sidelnr.app")]);
  // Who activities can be for: the children on this phone's teams, and anyone already in an activity.
  const teamKids = (
    await Promise.all(teams.map(async (t) => ((await canView(t)) ? (await currentChildren(t)).map((c) => firstName(playerName(t, c))) : [])))
  ).flat();
  const people = [...new Set([...teamKids, ...activities.map((a) => a.person)])].filter((p) => p !== "Me");

  // Upcoming games grouped by day.
  const days = new Map<string, Entry[]>();
  for (const e of upcoming) {
    const key = isoDateIn(e.game.kickoff, e.tz);
    days.set(key, [...(days.get(key) ?? []), e]);
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <Link href="/" className="text-xs font-semibold tracking-tight opacity-60">
          Sidelnr<span className="text-accent">.</span>
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">My Activities</h1>
        <p className="mt-1 text-sm opacity-70">Every game, training and activity for your family: when, where and how to get there.</p>
      </header>

      <main className="mt-4 space-y-5 px-4">
        <ActivityReminders vapidKey={pushPublicKey()} />
        {joinCode && <JoinCode initial={joinCode} highlight />}
        {teams.length > 0 && <InstallPrompt name="Sidelnr" icon="/app-icon/192" />}
        {teams.length === 0 && activities.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            Nothing here yet.{" "}
            <Link href="/" className="font-medium text-zinc-900 underline">
              Join your team
            </Link>{" "}
            with the code from your coach, or add an activity below (music, dance, school…), and it all shows up here.
          </div>
        )}

        {(teams.length > 0 || activities.length > 0) && upcoming.length === 0 && <p className="text-center text-sm text-zinc-500">Nothing coming up.</p>}

        {calToken && <AddToCalendar host={host} path={`/cal/${calToken}.ics`} label="Add everything to my calendar" />}

        {(childClashes > 0 || familyClashes > 0) && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${childClashes ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
            <div className="font-semibold">
              {childClashes > 0
                ? `${childClashes} clash${childClashes > 1 ? "es" : ""} coming up`
                : `${familyClashes} busy moment${familyClashes > 1 ? "s" : ""} coming up`}
            </div>
            <p className="mt-0.5 text-xs opacity-80">
              {childClashes > 0
                ? "Someone is down for two things at the same time."
                : "Two of your family are busy at the same time in different places."}
              {childClashes > 0 && familyClashes > 0 && " Also: things at the same time in different places."}
            </p>
          </div>
        )}

        <KidColours kids={[...new Set(upcoming.flatMap((e) => e.kids.map((k) => k.name)))]} />

        {days.size > 0 && (
          <MyPlayerViews
            list={
              <div className="space-y-5">
                {[...days.entries()].map(([day, entries]) => (
                  <section key={day}>
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{formatWeekday(entries[0].game.kickoff, entries[0].tz)}</h2>
                    <ul className="space-y-2">
                      {entries.map((e) => (
                        <GameCard key={`${e.team?.id ?? "activity"}-${e.game.id}`} e={e} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            }
            days={[...days.entries()].map(([day, entries]) => ({
              date: day,
              title: formatWeekday(entries[0].game.kickoff, entries[0].tz),
              count: entries.length,
              clash: entries.some((e) => e.clashes.some((c) => c.kind === "child")),
              training: entries.every((e) => e.training),
              duty: entries.some((e) => (e.duties?.length ?? 0) > 0),
              kids: [
                ...new Map(entries.flatMap((e) => e.kids.map((k) => [kidKey(k.name), { key: kidKey(k.name), training: !!e.training }] as const))).values(),
              ],
              node: (
                <ul className="space-y-2">
                  {entries.map((e) => (
                    <GameCard key={`${e.team?.id ?? "activity"}-${e.game.id}`} e={e} />
                  ))}
                </ul>
              ),
            }))}
          />
        )}

        {results.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent results</h2>
            <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white px-4 shadow-sm">
              {results.map((e) => {
                const s = ourScore(e.game, e.team.league_name)!;
                const res = s.us > s.them ? "W" : s.us < s.them ? "L" : "D";
                return (
                  <li key={`${e.team.id}-${e.game.id}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded text-xs font-semibold ${res === "W" ? "bg-emerald-500 text-white" : res === "L" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
                    >
                      {res}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {e.team.name} vs {opponent(e.game, e.team.league_name)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {s.us}–{s.them}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Activities</h2>
          <p className="mt-1 text-sm text-zinc-500">Music, dance, school, a sport that isn’t on Sidelnr: anything with a time and place.</p>
          <div className="mt-2">
            <ActivityList
              people={people}
              rows={activities.map((a) => ({
                id: a.id,
                name: a.name,
                person: a.person,
                schedule: a.source_url
                  ? `From ${(() => {
                      try {
                        return new URL(a.source_url).hostname.replace(/^www\./, "");
                      } catch {
                        return "a link";
                      }
                    })()} · ${a.extra.length} session${a.extra.length === 1 ? "" : "s"}${a.source_filter ? ` · “${a.source_filter}”` : ""}`
                  : a.weekly.length
                    ? `${weeklySummary(a)}${a.ends_on ? ` until ${a.ends_on.split("-").reverse().join("/")}` : ""}`
                    : `Once${a.extra[0] ? `, ${formatWeekday(new Date(a.extra[0].at), a.tz)} ${formatTime(new Date(a.extra[0].at), a.tz)}` : ""}`,
                imported: !!a.source_url,
                error: a.source_error,
                linked: !!a.linked,
                edit: editValues(a),
              }))}
            />
          </div>
          <details className="mt-3 border-t border-zinc-100 pt-3" open={activities.length === 0 && teams.length === 0}>
            <summary className="cursor-pointer font-semibold">+ Add an activity</summary>
            <div className="mt-3">
              <ActivityForm people={people} />
            </div>
          </details>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <JoinCode />
          </div>
          <details className="mt-3 border-t border-zinc-100 pt-3 text-sm">
            <summary className="cursor-pointer font-semibold">Share with another phone</summary>
            <div className="mt-3">
              <ShareActivities activities={activities.filter((a) => !a.linked).map((a) => ({ id: a.id, label: `${a.person} · ${a.name}` }))} />
            </div>
          </details>
        </section>

        {teams.length > 0 && <ForgetPhone />}
        <LegalLinks className="pt-2 text-zinc-400" />
      </main>
    </div>
  );
}

/** An activity as the edit form shows it (local dates and times in its timezone). */
function editValues(a: Activity): ActivityInitial {
  const hhmm = (d: Date) => {
    const m = minutesOfDay(d, a.tz);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const first = a.extra[0] ? new Date(a.extra[0].at) : null;
  return {
    id: a.id,
    person: a.person,
    name: a.name,
    location: a.location ?? "",
    mode: a.source_url ? "import" : a.weekly.length ? "weekly" : "once",
    days: a.weekly.map((w) => w.d),
    time: a.weekly[0]?.t ?? (first ? hhmm(first) : ""),
    minutes: a.weekly[0]?.m ?? a.extra[0]?.m ?? 60,
    startsOn: a.starts_on ?? "",
    endsOn: a.ends_on ?? "",
    date: first ? isoDateIn(first, a.tz) : "",
    url: a.source_url ?? "",
    filter: a.source_filter ?? "",
  };
}

function ActivityCard({ e }: { e: Entry }) {
  const a = e.activity!;
  const who = e.kids[0]?.name ?? "";
  return (
    <li
      data-kid={who ? kidKey(who) : undefined}
      style={{ borderLeftColor: "var(--kid, #e4e4e7)" }}
      className={`rounded-2xl border border-l-4 bg-white p-3 shadow-sm ${e.clashes.some((c) => c.kind === "child") ? "border-red-300" : e.clashes.length ? "border-amber-300" : "border-zinc-200"}`}
    >
      {e.clashes.map((c) => (
        <p
          key={c.text}
          className={`mb-2 rounded-xl px-3 py-2 text-xs font-medium ${c.kind === "child" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
        >
          {c.kind === "child" ? "Clash: " : "Heads-up: "}
          {c.text}
        </p>
      ))}
      <span className="block text-xs text-zinc-500">
        <b data-kid={kidKey(who)} className="font-semibold" style={{ color: "var(--kid)" }}>
          {who}
        </b>
        {a.kind && ` · ${a.kind}`}
      </span>
      <span className={`block font-semibold ${a.cancelled ? "text-zinc-400 line-through" : ""}`}>{a.name}</span>
      <span className="mt-0.5 block text-sm text-zinc-700">
        {a.cancelled ? "Not on this time" : a.minutes >= 24 * 60 ? "All day" : `${formatTime(e.game.kickoff, e.tz)} · ${a.minutes} min`}
      </span>
      {e.place && <span className="block text-xs text-zinc-500">{e.place}</span>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <SessionToggle activityId={a.id} start={a.start} cancelled={a.cancelled} />
        {e.place && !a.cancelled && <Directions place={e.place} className="ml-auto bg-zinc-900 text-white" />}
      </div>
    </li>
  );
}

function GameCard({ e }: { e: Entry }) {
  if (e.activity || !e.team) return <ActivityCard e={e} />;
  const { game, tz } = e;
  const team = e.team;
  const home = game.home === team.league_name;
  const meet = team.meet_minutes > 0 && !e.training ? meetingTime(game, team.meet_minutes, tz) : null;
  return (
    <li
      data-kid={e.kids[0] ? kidKey(e.kids[0].name) : undefined}
      style={{ borderLeftColor: "var(--kid, #e4e4e7)" }}
      className={`rounded-2xl border border-l-4 bg-white p-3 shadow-sm ${e.clashes.some((c) => c.kind === "child") ? "border-red-300" : e.clashes.length ? "border-amber-300" : "border-zinc-200"}`}
    >
      {e.clashes.map((c) => (
        <p
          key={c.text}
          className={`mb-2 rounded-xl px-3 py-2 text-xs font-medium ${c.kind === "child" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
        >
          {c.kind === "child" ? "Clash: " : "Heads-up: "}
          {c.text}
        </p>
      ))}
      <Link href={`/${team.id}`} className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc(team)} alt="" className="size-10 shrink-0 object-contain" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-zinc-500">
            {e.kids.map((k, i) => (
              <span key={k.name}>
                {i > 0 && " & "}
                <b data-kid={kidKey(k.name)} className="font-semibold" style={{ color: "var(--kid)" }}>
                  {k.name}
                </b>
              </span>
            ))}
            {e.kids.length > 0 && " · "}
            {team.name}
            {!e.training && roundLabel(game) && ` · ${roundLabel(game)}`}
          </span>
          <span className="block font-semibold">
            {e.training ? "Training" : `${home ? "vs" : "@"} ${opponent(game, team.league_name)}`}
          </span>
          <span className="mt-0.5 block text-sm text-zinc-700">
            {game.time === "Postponed"
              ? e.training
                ? "Cancelled"
                : "Postponed"
              : e.training
                ? `${formatTime(game.kickoff, tz)} · ${e.training.minutes} min`
                : `Kick-off ${formatTime(game.kickoff, tz)}`}
            {meet && game.time !== "Postponed" && ` · Meet ${meet}`}
          </span>
          {(game.pitch || e.place) && (
            <span className="block text-xs text-zinc-500">{[e.place, game.pitch && pitchLabel(game.pitch) !== e.place ? pitchLabel(game.pitch) : null].filter(Boolean).join(" · ")}</span>
          )}
        </span>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {e.duties?.map((d) => (
          <span key={d} className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900">
            You’re on: {d}
          </span>
        ))}
        {!e.training?.cancelled && e.kids.map((k) =>
          k.status ? (
            <span key={k.name} className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[k.status].cls}`}>
              {e.kids.length > 1 && `${k.name}: `}
              {STATUS[k.status].label}
            </span>
          ) : (
            <Link key={k.name} href={`/${team.id}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              Can {k.name} {e.training ? "come" : "play"}? Tap to answer
            </Link>
          ),
        )}
        {e.place && <Directions place={e.place} className="ml-auto bg-zinc-900 text-white" />}
      </div>
    </li>
  );
}
