import type { Metadata } from "next";
import Link from "next/link";
import { getTeam, firstName, playerName, type Team } from "@/lib/teams";
import { canView, currentChildren } from "@/lib/session";
import { knownTeamIds } from "@/lib/known-teams";
import { gamePlace, getLeagueData, meetingTime, opponent, ourScore, pitchLabel, roundLabel, type Game } from "@/lib/league";
import { getAttendance, type AttendanceStatus } from "@/lib/store";
import { formatTime, formatWeekday, isoDateIn } from "@/lib/time";
import { logoSrc } from "@/lib/brand";
import { now as clockNow } from "@/lib/clock";
import { Directions } from "@/components/Directions";

// My Player: every game for every team this phone follows, in one list: when,
// where (with directions), meeting time and whether you've said your child
// can play. For families with more than one child or team.

export const metadata: Metadata = { title: "My Player · Sidelnr", robots: { index: false } };

const STATUS: Record<AttendanceStatus, { label: string; cls: string }> = {
  yes: { label: "Can play", cls: "bg-emerald-50 text-emerald-800" },
  maybe: { label: "Maybe", cls: "bg-amber-50 text-amber-800" },
  no: { label: "Can't make it", cls: "bg-zinc-100 text-zinc-500" },
};
const GAME_WINDOW_MS = 90 * 60 * 1000; // a game stays "upcoming" until ~1.5h after kick-off

type Entry = {
  team: Team;
  game: Game;
  tz: string;
  place: string | null;
  kids: { name: string; status: AttendanceStatus | null }[];
  clashes: { kind: "child" | "family"; text: string }[];
};

const BUSY_AFTER_MS = 60 * 60 * 1000; // a game keeps you busy until ~1h after kick-off

/** From meeting time until an hour after kick-off. */
const busy = (e: Entry): [number, number] => {
  const k = e.game.kickoff.getTime();
  return [k - e.team.meet_minutes * 60_000, k + BUSY_AFTER_MS];
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
      const other = (y: Entry) => `${y.team.name} ${y.game.home === y.team.league_name ? "vs" : "@"} ${opponent(y.game, y.team.league_name)} at ${formatTime(y.game.kickoff, y.tz)}`;
      if (shared.length) {
        const who = shared.join(" & ");
        a.clashes.push({ kind: "child", text: `${who} ${shared.length > 1 ? "have" : "has"} another game at the same time: ${other(b)}.` });
        b.clashes.push({ kind: "child", text: `${who} ${shared.length > 1 ? "have" : "has"} another game at the same time: ${other(a)}.` });
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

export default async function MyPlayerPage() {
  const ids = await knownTeamIds();
  const teams = (await Promise.all(ids.map((id) => getTeam(id)))).filter((t): t is Team => t !== null);
  const now = clockNow().getTime();

  const perTeam = await Promise.all(
    teams.map(async (team) => {
      if (!(await canView(team))) return [];
      const [{ competition, tz, ourGames }, children, attendance] = await Promise.all([
        getLeagueData(team),
        currentChildren(team),
        getAttendance(team.id),
      ]);
      return ourGames.map(
        (game): Entry => ({
          team,
          game,
          tz,
          place: gamePlace(game.pitch, competition),
          clashes: [],
          kids: children.map((c) => ({
            name: firstName(playerName(team, c)),
            status: attendance.find((a) => a.game_id === game.id && a.player_id === c)?.status ?? null,
          })),
        }),
      );
    }),
  );
  const all = perTeam.flat();
  const upcoming = all.filter((e) => e.game.kickoff.getTime() + GAME_WINDOW_MS > now).sort((a, b) => a.game.kickoff.getTime() - b.game.kickoff.getTime());
  const results = all
    .filter((e) => e.game.kickoff.getTime() + GAME_WINDOW_MS <= now && e.game.score)
    .sort((a, b) => b.game.kickoff.getTime() - a.game.kickoff.getTime())
    .slice(0, 6);

  const { child: childClashes, family: familyClashes } = findClashes(upcoming);

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
        <h1 className="mt-2 text-2xl font-semibold">My Player</h1>
        <p className="mt-1 text-sm opacity-70">Every game for the teams on this phone: when, where and how to get there.</p>
      </header>

      <main className="mt-4 space-y-5 px-4">
        {teams.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            No teams on this phone yet.{" "}
            <Link href="/" className="font-medium text-zinc-900 underline">
              Join your team
            </Link>{" "}
            with the code from your coach, and its games show up here.
          </div>
        )}

        {teams.length > 0 && upcoming.length === 0 && <p className="text-center text-sm text-zinc-500">No games coming up.</p>}

        {(childClashes > 0 || familyClashes > 0) && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${childClashes ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
            <div className="font-semibold">
              {childClashes > 0
                ? `${childClashes} game clash${childClashes > 1 ? "es" : ""} coming up`
                : `${familyClashes} busy moment${familyClashes > 1 ? "s" : ""} coming up`}
            </div>
            <p className="mt-0.5 text-xs opacity-80">
              {childClashes > 0
                ? "A child is down for two games at the same time. Let one of the coaches know."
                : "Two of your kids play at the same time at different venues."}
              {childClashes > 0 && familyClashes > 0 && " Also: games at the same time at different venues."}
            </p>
          </div>
        )}

        {[...days.entries()].map(([day, entries]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{formatWeekday(entries[0].game.kickoff, entries[0].tz)}</h2>
            <ul className="space-y-2">
              {entries.map((e) => (
                <GameCard key={`${e.team.id}-${e.game.id}`} e={e} />
              ))}
            </ul>
          </section>
        ))}

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
      </main>
    </div>
  );
}

function GameCard({ e }: { e: Entry }) {
  const { team, game, tz } = e;
  const home = game.home === team.league_name;
  const meet = team.meet_minutes > 0 ? meetingTime(game, team.meet_minutes, tz) : null;
  return (
    <li
      className={`rounded-2xl border bg-white p-3 shadow-sm ${e.clashes.some((c) => c.kind === "child") ? "border-red-300" : e.clashes.length ? "border-amber-300" : "border-zinc-200"}`}
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
            {e.kids.length ? `${e.kids.map((k) => k.name).join(" & ")} · ` : ""}
            {team.name}
            {roundLabel(game) && ` · ${roundLabel(game)}`}
          </span>
          <span className="block font-semibold">
            {home ? "vs" : "@"} {opponent(game, team.league_name)}
          </span>
          <span className="mt-0.5 block text-sm text-zinc-700">
            {game.time === "Postponed" ? "Postponed" : `Kick-off ${formatTime(game.kickoff, tz)}`}
            {meet && game.time !== "Postponed" && ` · Meet ${meet}`}
          </span>
          {(game.pitch || e.place) && (
            <span className="block text-xs text-zinc-500">{[e.place, game.pitch && pitchLabel(game.pitch) !== e.place ? pitchLabel(game.pitch) : null].filter(Boolean).join(" · ")}</span>
          )}
        </span>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {e.kids.map((k) =>
          k.status ? (
            <span key={k.name} className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[k.status].cls}`}>
              {e.kids.length > 1 && `${k.name}: `}
              {STATUS[k.status].label}
            </span>
          ) : (
            <Link key={k.name} href={`/${team.id}`} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              Can {k.name} play? Tap to answer
            </Link>
          ),
        )}
        {e.place && <Directions place={e.place} className="ml-auto bg-zinc-900 text-white" />}
      </div>
    </li>
  );
}
