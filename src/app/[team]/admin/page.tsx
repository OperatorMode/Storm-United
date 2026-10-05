import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { TabBar } from "@/components/TabBar";
import { tabData } from "@/lib/tabs";
import { AdminLogin } from "./AdminLogin";
import { ScoreForm } from "./ScoreForm";
import { GoalieAssign } from "./GoalieAssign";
import { TeamSettings } from "./TeamSettings";
import { MergePlayers } from "./MergePlayers";
import { listAnnouncements, listChat } from "@/lib/messages";
import { adminLogout } from "./actions";
import { isSuperAdmin, isTeamAdmin } from "@/lib/session";
import { formatDay, getLeagueData, opponent, votingState } from "@/lib/league";
import { getAttendance, getBallots, getManualScores } from "@/lib/store";
import { goaliesForGame, goalieTally } from "@/lib/goalies";
import { tally, winners } from "@/lib/mvp";
import { firstName, getTeam, playerName } from "@/lib/teams";
import { now as clockNow } from "@/lib/clock";

export async function generateMetadata({ params }: PageProps<"/[team]/admin">): Promise<Metadata> {
  const team = await getTeam((await params).team);
  return { title: `${team?.name ?? "Team"} · Manager’s Corner`, robots: { index: false } };
}

export default async function AdminPage({ params }: PageProps<"/[team]/admin">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();

  const tabsPromise = tabData(team);
  const header = (
    <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
      <h1 className="mt-1 text-2xl font-semibold">Manager’s Corner</h1>
    </header>
  );

  if (!(await isTeamAdmin(team))) {
    const tabs = await tabsPromise;
    return (
      <div className="mx-auto max-w-md pb-24">
        {header}
        <main className="mt-4 px-4">
          <Card title="Managers only">
            <p className="mb-3 text-sm text-zinc-500">
              Enter the manager PIN to see the season MVP tally, goalies, backup scores and team settings.
            </p>
            <AdminLogin teamId={team.id} />
          </Card>
        </main>
        <TabBar teamId={team.id} active="manager" {...tabs} />
      </div>
    );
  }

  const [{ ourGames }, ballots, manual, attendance, superAdmin, tabs, chat, posts] = await Promise.all([
    getLeagueData(team),
    getBallots(team.id),
    getManualScores(team.id),
    getAttendance(team.id),
    isSuperAdmin(),
    tabsPromise,
    listChat(team.id),
    listAnnouncements(team.id),
  ]);
  const now = clockNow();

  // Removed players who still have history — candidates for "Merge players".
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const removed = team.allPlayers
    .filter((p) => !p.active)
    .map((p) => {
      const answers = attendance.filter((a) => a.player_id === p.id).length;
      const votes = ballots.filter((b) => b.voter_id === p.id || [b.first, b.second, b.third].includes(p.id)).length;
      const messages = chat.filter((m) => m.author_id === p.id).length;
      const acks = posts.filter((a) => a.acks.includes(p.id)).length;
      const parts = [
        answers && plural(answers, "attendance answer"),
        votes && plural(votes, "vote"),
        acks && plural(acks, "acknowledgement"),
        messages && plural(messages, "chat message"),
      ].filter(Boolean);
      return { id: p.id, name: p.name, summary: parts.join(" · ") };
    })
    .filter((r) => r.summary);
  const played = ourGames.filter((g) => g.kickoff.getTime() <= now.getTime());
  const us = team.league_name;
  const nameOf = (id: string) => playerName(team, id);
  // Tallies include players who have since left the squad, so history isn't lost.
  const everyone = team.allPlayers.map((p) => p.id);

  const goalieRows = goalieTally(attendance, played, everyone).filter(
    (r) => r.halves > 0 || team.players.some((p) => p.id === r.playerId),
  );
  const SLOT = { "1st": "1st", "2nd": "2nd", full: "FT" } as const;

  const season = tally(ballots, team.players.map((p) => p.id));
  const gameWins = new Map<string, number>();
  for (const g of played) {
    if (votingState(g, now) !== "closed") continue;
    for (const w of winners(tally(ballots.filter((b) => b.game_id === g.id), everyone))) {
      gameWins.set(w, (gameWins.get(w) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-md pb-24">
      {header}
      <main className="mt-4 space-y-4 px-4">
      <div className="grid grid-cols-2 gap-2 text-sm font-medium">
        <Link href={`/${team.id}/board`} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm">
          📣 Post to board
        </Link>
        <Link href={`/${team.id}/chat`} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm">
          💬 Team chat
        </Link>
      </div>

      <Card title="Season MVP" aside="Managers only">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-zinc-500">
              <th className="w-6 py-1.5 font-medium">#</th>
              <th className="py-1.5 font-medium">Player</th>
              <th className="py-1.5 text-center font-medium">Game MVPs</th>
              <th className="py-1.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {season.map((r, i) => (
              <tr key={r.playerId} className={`border-t border-zinc-100 ${i === 0 && r.points > 0 ? "font-semibold" : ""}`}>
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{nameOf(r.playerId)}</td>
                <td className="py-2 text-center">{gameWins.get(r.playerId) ?? 0}</td>
                <td className="py-2 text-right">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {team.goalie_enabled && (
        <>
          <Card title="Goalie tally" aside="Played games · full game = 2 halves">
            {goalieRows.every((r) => r.halves === 0) ? (
              <p className="text-sm text-zinc-500">No goalies recorded for played games yet.</p>
            ) : (
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1.5 font-medium">Player</th>
                    <th className="py-1.5 font-medium">Games</th>
                    <th className="py-1.5 text-right font-medium">Halves</th>
                  </tr>
                </thead>
                <tbody>
                  {goalieRows.map((r) => (
                    <tr key={r.playerId} className="border-t border-zinc-100 align-top">
                      <td className="py-2 pr-2">{nameOf(r.playerId)}</td>
                      <td className="py-2 text-xs text-zinc-600">
                        {r.games.length ? r.games.map((g) => `Rd ${g.round} ${SLOT[g.goalie]}`).join(" · ") : "—"}
                      </td>
                      <td className="py-2 text-right font-semibold">{r.halves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Assign goalies" aside="Overrides parents' ticks">
            <ul className="space-y-4">
              {ourGames.map((g) => {
                const { first, second } = goaliesForGame(attendance, g.id);
                const clash = first.length > 1 || second.length > 1;
                const players = team.players.map((p) => ({
                  ...p,
                  out: attendance.some((a) => a.game_id === g.id && a.player_id === p.id && a.status === "no"),
                }));
                const names = (ids: string[]) => ids.map((id) => firstName(nameOf(id))).join(", ") || "none";
                return (
                  <li key={g.id}>
                    <div className="mb-1 text-xs text-zinc-500">
                      Rd {g.round} vs {opponent(g, us)} · {formatDay(g.kickoff)}
                    </div>
                    <GoalieAssign
                      teamId={team.id}
                      gameId={g.id}
                      players={players}
                      first={first[0] ?? null}
                      second={second[0] ?? null}
                    />
                    {clash && (
                      <div className="mt-1 text-xs text-amber-700">
                        Several volunteers — 1st: {names(first)} · 2nd: {names(second)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <Card title="Votes by game">
        {played.length === 0 ? (
          <p className="text-sm text-zinc-500">No games played yet.</p>
        ) : (
          <ul className="space-y-4">
            {[...played].reverse().map((g) => {
              const gb = ballots.filter((b) => b.game_id === g.id);
              const t = tally(gb, everyone).filter((r) => r.points > 0);
              const voted = new Set(gb.map((b) => b.voter_id));
              const missing = team.players.map((p) => p.id).filter((v) => !voted.has(v));
              return (
                <li key={g.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                      Rd {g.round} vs {opponent(g, us)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {gb.length} ballots · {votingState(g, now) === "open" ? "open" : "closed"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    {t.length ? t.map((r) => `${nameOf(r.playerId)} ${r.points}`).join(" · ") : "No votes"}
                  </div>
                  {missing.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-400">
                      Not voted: {missing.map((v) => firstName(nameOf(v))).join(", ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Backup scores" aside="Used only if the league hasn't posted one">
        {played.length === 0 ? (
          <p className="text-sm text-zinc-500">Scores can be entered once a game has kicked off.</p>
        ) : (
          <ul className="space-y-3">
            {played.map((g) => (
              <li key={g.id}>
                <div className="mb-1 text-xs text-zinc-500">
                  Rd {g.round} · {formatDay(g.kickoff)}
                  {g.scoreSource === "league" && " · league score posted"}
                </div>
                <ScoreForm teamId={team.id} gameId={g.id} home={g.home} away={g.away} initial={manual[g.id] ?? null} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {removed.length > 0 && (
        <Card title="Merge players" aside="Renamed someone?">
          <p className="mb-3 text-xs text-zinc-500">
            These removed players still have history. If one is just an old spelling of a current player, merge them to
            move everything across.
          </p>
          <MergePlayers teamId={team.id} removed={removed} current={team.players} />
        </Card>
      )}

      <Card title="Team settings">
        <TeamSettings
          teamId={team.id}
          players={team.players.map((p) => p.name).join("\n")}
          hasJoinCode={!!team.join_code_hash}
          meetMinutes={team.meet_minutes}
          goalieEnabled={team.goalie_enabled}
        />
      </Card>

      <div className="flex items-center justify-center gap-6 pt-2 text-sm text-zinc-500">
        {superAdmin && (
          <Link href="/super" className="underline">
            All teams
          </Link>
        )}
        <form action={adminLogout.bind(null, team.id)}>
          <button className="underline">Lock Manager’s Corner</button>
        </form>
      </div>
      </main>
      <TabBar teamId={team.id} active="manager" {...tabs} />
    </div>
  );
}
