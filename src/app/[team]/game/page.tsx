import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SidelnrLink } from "@/components/SidelnrLink";
import { TabBar } from "@/components/TabBar";
import { tabData } from "@/lib/tabs";
import { getTeam, firstName } from "@/lib/teams";
import { isTeamAdmin } from "@/lib/session";
import { isEvent } from "@/lib/my-events";
import { formatDay, getLeagueData, opponent } from "@/lib/league";
import { formatTime } from "@/lib/time";
import { getAttendance } from "@/lib/store";
import { listRotations } from "@/lib/rotation";
import { emptyLive, getLive } from "@/lib/game-live";
import { roleInText, roleName } from "@/lib/role";
import { now as clockNow } from "@/lib/clock";
import { GameDay } from "./GameDay";

export const metadata: Metadata = { title: "My Game", robots: { index: false } };

// My Game (managers): the sideline screen for today's game. The field with the
// starting line-up from the saved rotation, the clock with the rotation's swaps
// as suggestions, and the score with who scored.
export default async function GamePage({ params, searchParams }: PageProps<"/[team]/game">) {
  const team = await getTeam((await params).team);
  if (!team || isEvent(team)) notFound();
  const tabs = await tabData(team);
  const header = (
    <header className="jersey px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <SidelnrLink />
      <div className="text-xs uppercase tracking-widest text-on-team/60">{team.name}</div>
      <h1 className="mt-0.5 text-xl font-semibold">My Game</h1>
    </header>
  );
  if (!(await isTeamAdmin(team))) {
    return (
      <div className="mx-auto max-w-md pb-24">
        {header}
        <main className="mt-4 px-4">
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            My Game is for the team’s managers.{" "}
            <Link href={`/${team.id}/admin`} className="font-medium text-zinc-900 underline">
              Unlock Manager’s Corner
            </Link>{" "}
            first.
          </p>
        </main>
        <TabBar teamId={team.id} active="game" {...tabs} />
      </div>
    );
  }

  const { ourGames, tz } = await getLeagueData(team);
  const us = team.league_name;
  const now = clockNow().getTime();
  const picked = (await searchParams).g;
  // Today's game: the one picked, else one in progress, else the next (or one that started in the last 3 hours).
  const options = ourGames.filter((g) => g.kickoff.getTime() > now - 3 * 3600_000 && g.time !== "Postponed").slice(0, 6);
  const game = ourGames.find((g) => g.id === picked) ?? options[0] ?? null;
  if (!game) {
    return (
      <div className="mx-auto max-w-md pb-24">
        {header}
        <main className="mt-4 px-4">
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">No game coming up.</p>
        </main>
        <TabBar teamId={team.id} active="game" {...tabs} />
      </div>
    );
  }

  const [attendance, rotations, live] = await Promise.all([getAttendance(team.id), listRotations(team.id), getLive(team.id, game.id)]);
  const out = new Set(attendance.filter((a) => a.game_id === game.id && a.status === "no").map((a) => a.player_id));
  const players = team.players.map((p) => ({ id: p.id, name: firstName(p.name) }));
  const plan = rotations[game.id] ?? null;
  const available = players.map((p) => p.id).filter((id) => !out.has(id));
  const title = `${game.home === us ? "vs" : "@"} ${opponent(game, us)}`;

  return (
    <div className="mx-auto max-w-md pb-24">
      {header}
      <main className="mt-3 space-y-3 px-4">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{title}</span>
          <span className="text-zinc-500">
            {formatDay(game.kickoff, tz)}, {formatTime(game.kickoff, tz)}
          </span>
        </div>
        {options.length > 1 && (
          <div className="flex gap-2 overflow-x-auto text-xs">
            {options.map((g) => (
              <Link
                key={g.id}
                href={`/${team.id}/game?g=${encodeURIComponent(g.id)}`}
                className={`shrink-0 rounded-full px-3 py-1 ${g.id === game.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
              >
                {formatDay(g.kickoff, tz)}
              </Link>
            ))}
          </div>
        )}
        {!plan && (
          <p className="rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
            No rotation saved for this game, so there are no swap reminders. Set one up in{" "}
            <Link href={`/${team.id}/admin`} className="underline">
              Manager’s Corner → Game rotation
            </Link>
            , or just drag players on and off.
          </p>
        )}
        <GameDay
          key={game.id}
          teamId={team.id}
          gameId={game.id}
          title={title}
          players={players}
          available={available}
          plan={
            plan
              ? {
                  minutes: plan.minutes ?? Array.from({ length: plan.periods }, () => 1),
                  spots: plan.spots,
                  parts: plan.shape?.parts ?? null,
                  partMinutes: plan.shape?.partMinutes ?? null,
                }
              : null
          }
          onFieldCount={plan?.onField ?? Math.min(available.length, 9)}
          layout={team.field_layout ?? {}}
          // Until kick-off, the line-up follows the latest saved rotation; after it, it's as the coach set it.
          initial={live?.startedAt ? live : emptyLive()}
          roleWord={team.goalie_enabled ? roleInText(roleName(team)) : null}
          keeperTag={!team.goalie_enabled || /^goal/i.test(roleName(team)) ? "GK" : roleName(team).slice(0, 3)}
        />
      </main>
      <TabBar teamId={team.id} active="game" {...tabs} />
    </div>
  );
}
