import type { Metadata } from "next";
import { gameParts, partLabel, partPlural, roleInText, roleName, rolePlural, slotLabel } from "@/lib/role";
import { SidelnrLink } from "@/components/SidelnrLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { Section } from "@/components/Section";
import { TabBar } from "@/components/TabBar";
import { tabData } from "@/lib/tabs";
import { AdminLogin } from "./AdminLogin";
import { ScoreForm } from "./ScoreForm";
import { GoalieAssign } from "./GoalieAssign";
import { TeamSettings } from "./TeamSettings";
import { MergePlayers } from "./MergePlayers";
import { SeasonRollover } from "./SeasonRollover";
import { TrainingAdmin } from "./TrainingAdmin";
import { DutyAdmin } from "./DutyAdmin";
import { RotationAdmin } from "./RotationAdmin";
import { listRotations } from "@/lib/rotation";
import { SUGGESTED_DUTIES, listDuties, listDutySignups } from "@/lib/duties";
import { listTraining } from "@/lib/training";
import { formatTime } from "@/lib/time";
import { listAnnouncements, listChat } from "@/lib/messages";
import { adminLogout } from "./actions";
import { adminAccess, currentManagerId, isSuperAdmin } from "@/lib/session";
import { teamManagerIds } from "@/lib/accounts";
import { AddToMyTeams } from "./AccountLink";
import { emailEnabled } from "@/lib/email";
import { competitionLabel, formatDay, getLeagueData, listCompetitions, roundLabel, opponent, votingState } from "@/lib/league";
import { getAttendance, getBallots, getManualScores } from "@/lib/store";
import { roleByPart, roleTally } from "@/lib/goalies";
import { leagueMessagesFor } from "@/lib/league-messages";
import { memberLabel, openReports } from "@/lib/dms";
import { ReportedMessages } from "./ReportedMessages";
import { TeamPhones } from "./TeamPhones";
import { listPhones } from "@/lib/phones";
import { tally, winners } from "@/lib/mvp";
import { firstName, getTeam, playerName } from "@/lib/teams";
import { now as clockNow } from "@/lib/clock";

// Finding the squad on the league's website can take a minute or two.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/[team]/admin">): Promise<Metadata> {
  const team = await getTeam((await params).team);
  return { title: `${team?.name ?? "Team"} · Manager’s Corner`, robots: { index: false } };
}

export default async function AdminPage({ params, searchParams }: PageProps<"/[team]/admin">) {
  const team = await getTeam((await params).team);
  const created = (await searchParams).created !== undefined;
  if (!team) notFound();

  const tabsPromise = tabData(team);
  const header = (
    <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <SidelnrLink />
      <div className="text-xs uppercase tracking-widest text-on-team/50">{team.name}</div>
      <h1 className="mt-1 text-2xl font-semibold">Manager’s Corner</h1>
    </header>
  );

  const access = await adminAccess(team);
  if (!access) {
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
            {emailEnabled() && <div className="mt-4 border-t border-zinc-100 pt-4 text-center text-sm">
              <span className="text-zinc-500">Have a Sidelnr account? </span>
              <Link href={`/login?next=/${team.id}/admin`} className="font-medium underline">
                Sign in with email
              </Link>
            </div>}
          </Card>
        </main>
        <TabBar teamId={team.id} active="manager" {...tabs} />
      </div>
    );
  }

  const [{ ourGames, tz }, ballots, manual, attendance, superAdmin, tabs, chat, posts, managerId, managers, competitions] = await Promise.all([
    getLeagueData(team),
    getBallots(team.id),
    getManualScores(team.id),
    getAttendance(team.id),
    isSuperAdmin(),
    tabsPromise,
    listChat(team.id),
    listAnnouncements(team.id),
    currentManagerId(),
    teamManagerIds(team.id),
    listCompetitions(),
  ]);
  // League announcements (to all teams, or to managers only), the last 60 days.
  const comp = team.competition_id ? competitions.find((c) => c.id === team.competition_id) : undefined;
  const leagueNews = comp
    ? (await leagueMessagesFor(comp.league_id, comp.id)).filter((m) => clockNow().getTime() - new Date(m.created_at).getTime() < 60 * 24 * 60 * 60 * 1000)
    : [];
  // Private messages families reported to the managers, and the phones following each child.
  const [reports, phones] = await Promise.all([openReports(team.id).catch(() => []), listPhones(team.id)]);
  const [training, duties, dutySignups, rotations] = await Promise.all([
    listTraining(team.id),
    listDuties(team.id),
    listDutySignups(team.id),
    listRotations(team.id),
  ]);
  // Rotations only count for this season's games.
  const seasonRotations = Object.fromEntries(Object.entries(rotations).filter(([id]) => ourGames.some((g) => g.id === id)));
  const lastPlan = Object.values(seasonRotations).at(-1);
  const now = clockNow();
  const linked = !!managerId && managers.includes(managerId);

  // Removed players who still have history, candidates for "Merge players".
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
  const role = roleName(team); // the special role, e.g. "Goalie"
  const nameOf = (id: string) => playerName(team, id);
  // Tallies include players who have since left the squad, so history isn't lost.
  const everyone = team.allPlayers.map((p) => p.id);

  const gp = gameParts(team); // how games are split: halves, quarters, innings...
  const goalieRows = roleTally(attendance, played, everyone, gp.count).filter(
    (r) => r.parts > 0 || team.players.some((p) => p.id === r.playerId),
  );

  // This season = the current competition's games; votes from earlier seasons are history.
  const seasonGames = new Set(ourGames.map((g) => g.id));
  const seasonBallots = ballots.filter((b) => seasonGames.has(b.game_id));
  const earlierBallots = ballots.filter((b) => !seasonGames.has(b.game_id));
  const season = tally(seasonBallots, team.players.map((p) => p.id));
  const earlier = tally(earlierBallots, everyone).filter((r) => r.points > 0);
  // Season over: games were played and none are left.
  const lastKickoff = ourGames.at(-1)?.kickoff.getTime() ?? 0;
  const seasonOver = ourGames.length > 0 && lastKickoff + 2 * 60 * 60 * 1000 < now.getTime();
  const rollover = (
    <SeasonRollover
      teamId={team.id}
      teamName={team.name}
      currentLabel={competitions.find((c) => c.id === team.competition_id) ? competitionLabel(competitions.find((c) => c.id === team.competition_id)!) : null}
      currentCompetition={team.competition_id}
      currentName={team.league_name}
      players={team.players}
    />
  );
  const gameWins = new Map<string, number>();
  for (const g of played) {
    if (votingState(g, now) !== "closed") continue;
    for (const w of winners(tally(seasonBallots.filter((b) => b.game_id === g.id), everyone))) {
      gameWins.set(w, (gameWins.get(w) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-md pb-24">
      {header}
      <main className="mt-4 space-y-4 px-4">
        <p className={`rounded-xl px-3 py-2 text-xs ${access === "owner" ? "bg-amber-50 text-amber-900" : "bg-zinc-100 text-zinc-600"}`}>
          {access === "manager"
            ? "Unlocked by your manager account."
            : access === "pin"
              ? "Unlocked with this team’s PIN on this device."
              : "Unlocked with the Sidelnr owner PIN, which opens every team on this device."}{" "}
          Lock it at the bottom of this page.
        </p>
        {seasonOver && (
          <Section title="New season" aside="Season finished" open>
            <p className="mb-3 text-sm text-zinc-500">
              The last game has been played. Before {team.name} rolls into a new season, answer three quick questions.
            </p>
            {rollover}
          </Section>
        )}
      {created && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">{team.name} is ready</div>
          <p className="mt-1">
            Share <b>sidelnr.app/{team.id}</b> with your families
            {team.join_code_hash ? " together with your join code" : ""}. They pick their child once and can add the app to
            their home screen.
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Tip: post a welcome message on the Board. Families get notified once they switch notifications on.
          </p>
        </div>
      )}
      {!linked && (managerId || emailEnabled()) && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          {managerId ? (
            <>
              <span>Keep this team in My teams on any device.</span>
              <AddToMyTeams teamId={team.id} teamName="to My teams" />
            </>
          ) : (
            <>
              <span>Sign in with email to manage all your teams in one place.</span>
              <Link href={`/login?next=/${team.id}/admin`} className="shrink-0 font-semibold underline">
                Sign in
              </Link>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 text-sm font-medium">
        <Link href={`/${team.id}/board`} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm">
          Post to board
        </Link>
        <Link href={`/${team.id}/chat`} className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-center shadow-sm">
          Team chat
        </Link>
      </div>

      {reports.length > 0 && (
        <Section title="Reported messages" aside={`${reports.length} to look at`} open>
          <ReportedMessages
            teamId={team.id}
            reports={reports.map((r) => ({
              id: r.id,
              from: r.message ? memberLabel(team, r.message.author) : "Unknown",
              reporter: memberLabel(team, r.reporter),
              body: r.message?.body ?? "(message deleted)",
              when: r.message ? formatDay(new Date(r.message.created_at), tz) : "",
            }))}
          />
        </Section>
      )}

      {leagueNews.length > 0 && comp && (
        <Section title="League announcements" aside={comp.league.short_name ?? comp.league.name} open={now.getTime() - new Date(leagueNews[0].created_at).getTime() < 3 * 24 * 60 * 60 * 1000}>
          <ul className="space-y-3 text-sm">
            {leagueNews.map((m) => (
              <li key={m.id}>
                <div className="text-xs text-zinc-500">
                  {formatDay(new Date(m.created_at), tz)} · {m.audience === "all" ? "To all teams (also on the Board)" : "To team managers"}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Game rotation" aside="Fair playing time">
        <RotationAdmin
          role={team.goalie_enabled ? role : null}
          gameParts={gp}
          teamId={team.id}
          players={team.players}
          allSaved={seasonRotations}
          defaults={{
            shape: lastPlan?.shape ?? { parts: gp.count, partMinutes: gp.count >= 4 ? 10 : 20, swapEvery: gp.count >= 4 ? 0 : 10 },
            onField: lastPlan?.onField ?? 6,
            goaliesStayOn: lastPlan?.goaliesStayOn ?? false,
          }}
          games={ourGames
            .filter((g) => g.kickoff.getTime() + 3 * 60 * 60 * 1000 > now.getTime() && g.time !== "Postponed")
            .slice(0, 4)
            .map((g) => {
              // Everyone except those who said they can't make it.
              const out = attendance.filter((a) => a.game_id === g.id && a.status === "no").map((a) => a.player_id);
              const byPart = roleByPart(attendance, g.id, gp.count);
              return {
                id: g.id,
                label: `${formatDay(g.kickoff, tz)} · ${g.home === us ? "vs" : "@"} ${opponent(g, us)}`,
                available: team.players.map((p) => p.id).filter((id) => !out.includes(id)),
                goalies: byPart.map((ids) => ids[0] ?? null),
                saved: seasonRotations[g.id] ?? null,
              };
            })}
        />
      </Section>

      {team.goalie_enabled &&
        (() => {
          const upcoming = ourGames.filter((g) => g.kickoff.getTime() + 2 * 60 * 60 * 1000 > now.getTime());
          const soon = upcoming.slice(0, 3);
          const rest = ourGames.filter((g) => !soon.includes(g));
          const assign = (games: typeof ourGames) => (
            <ul className="space-y-4">
              {games.map((g) => {
                const byPart = roleByPart(attendance, g.id, gp.count);
                const clashes = byPart.flatMap((ids, p) => (ids.length > 1 ? [`${partLabel(p, gp, true)}: ${ids.map((id) => firstName(nameOf(id))).join(", ")}`] : []));
                const players = team.players.map((p) => ({
                  ...p,
                  out: attendance.some((a) => a.game_id === g.id && a.player_id === p.id && a.status === "no"),
                }));
                return (
                  <li key={g.id}>
                    <div className="mb-1 text-xs text-zinc-500">
                      {roundLabel(g)} vs {opponent(g, us)} · {formatDay(g.kickoff, tz)}
                    </div>
                    <GoalieAssign
                      teamId={team.id}
                      gameId={g.id}
                      players={players}
                      assigned={byPart.map((ids) => ids[0] ?? null)}
                      partNames={byPart.map((_, p) => partLabel(p, gp))}
                    />
                    {clashes.length > 0 && <div className="mt-1 text-xs text-amber-700">Several volunteers. {clashes.join(" · ")}</div>}
                  </li>
                );
              })}
            </ul>
          );
          return (
            <Section title={rolePlural(role)} aside="Assign · tally">
              {soon.length ? assign(soon) : <p className="text-sm text-zinc-500">No upcoming games.</p>}
              {rest.length > 0 && (
                <details className="mt-4 border-t border-zinc-100 pt-3 text-sm">
                  <summary className="cursor-pointer text-zinc-600">Other games ({rest.length})</summary>
                  <div className="mt-3">{assign(rest)}</div>
                </details>
              )}
              <details className="mt-3 border-t border-zinc-100 pt-3 text-sm">
                <summary className="cursor-pointer text-zinc-600">{role} tally ({partPlural(gp)} as {roleInText(role)})</summary>
                {goalieRows.every((r) => r.parts === 0) ? (
                  <p className="mt-2 text-zinc-500">No {roleInText(rolePlural(role))} recorded for played games yet.</p>
                ) : (
                  <table className="mt-2 w-full tabular-nums">
                    <tbody>
                      {goalieRows.map((r) => (
                        <tr key={r.playerId} className="border-t border-zinc-100 align-top">
                          <td className="py-1.5 pr-2">{nameOf(r.playerId)}</td>
                          <td className="py-1.5 text-xs text-zinc-600">
                            {r.games.length ? r.games.map((g) => `Rd ${g.round} ${slotLabel(g.slot, gp)}`).join(" · ") : "-"}
                          </td>
                          <td className="py-1.5 text-right font-semibold">{r.parts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </details>
            </Section>
          );
        })()}

      <Section title="Training" aside="Sessions">
        <TrainingAdmin
          teamId={team.id}
          squad={team.players.length}
          sessions={training
            .filter((t) => new Date(t.starts_at).getTime() + t.minutes * 60_000 > now.getTime())
            .slice(0, 12)
            .map((t) => {
              const count = (status: string) =>
                team.players.filter((p) => attendance.some((a) => a.game_id === t.id && a.player_id === p.id && a.status === status)).length;
              return {
                id: t.id,
                when: `${formatDay(new Date(t.starts_at), tz)}, ${formatTime(new Date(t.starts_at), tz)}`,
                minutes: t.minutes,
                location: t.location,
                cancelled: t.cancelled,
                series: !!t.series_id,
                coming: count("yes"),
                maybe: count("maybe"),
                out: count("no"),
              };
            })}
        />
      </Section>

      <Section title="Duty roster" aside="Oranges, snacks…">
        <DutyAdmin
          teamId={team.id}
          duties={duties}
          suggestions={SUGGESTED_DUTIES}
          families={team.players.map((p) => ({ id: p.id, label: `${firstName(p.name)}’s family` }))}
          games={ourGames
            .filter((g) => g.kickoff.getTime() > now.getTime() && g.time !== "Postponed")
            .slice(0, 6)
            .map((g) => ({
              gameId: g.id,
              label: `${formatDay(g.kickoff, tz)} · ${g.home === us ? "vs" : "@"} ${opponent(g, us)}`,
              slots: duties.map((duty) => ({ duty, playerId: dutySignups.find((d) => d.game_id === g.id && d.duty === duty)?.player_id ?? null })),
            }))}
        />
      </Section>

      <Section title="Season MVP" aside="Tally">
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
      </Section>

      <Section title="Votes by game">
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
                      {roundLabel(g)} vs {opponent(g, us)}
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
      </Section>

      <Section title="Backup scores" aside="If the league hasn't">
        {played.length === 0 ? (
          <p className="text-sm text-zinc-500">Scores can be entered once a game has kicked off.</p>
        ) : (
          <ul className="space-y-3">
            {played.map((g) => (
              <li key={g.id}>
                <div className="mb-1 text-xs text-zinc-500">
                  {roundLabel(g)} · {formatDay(g.kickoff, tz)}
                  {g.scoreSource === "league" && " · league score posted"}
                </div>
                <ScoreForm teamId={team.id} gameId={g.id} home={g.home} away={g.away} initial={manual[g.id] ?? null} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Connected phones"
        aside={`${new Set(phones.filter((p) => p.children).map((p) => p.device_id)).size} phone${new Set(phones.filter((p) => p.children).map((p) => p.device_id)).size === 1 ? "" : "s"}`}
      >
        <p className="mb-2 text-xs text-zinc-500">
          Which phones follow each child. If a phone picked a child it shouldn’t have, remove it. Phones show here once they’ve
          opened the team since this was added.
        </p>
        <TeamPhones
          teamId={team.id}
          kids={team.players.map((p) => ({
            id: p.id,
            name: firstName(p.name),
            phones: phones
              .filter((ph) => ph.children.split(",").includes(p.id))
              .map((ph) => ({ deviceId: ph.device_id, device: ph.device ?? "Phone", seen: formatDay(new Date(ph.last_seen), tz), self: ph.is_self })),
          }))}
        />
      </Section>

      <Section title="Team settings">
        <TeamSettings
          teamId={team.id}
          players={team.players.map((p) => p.name).join("\n")}
          hasJoinCode={!!team.join_code_hash}
          meetMinutes={team.meet_minutes}
          goalieEnabled={team.goalie_enabled}
          roleName={team.role_name ?? null}
          gameParts={gp.count}
          partName={gp.name}
          muteLeague={team.competition_id ? !!team.mute_league : null}
        />
      </Section>

      {removed.length > 0 && (
        <Section title="Merge players" aside="Renamed someone?">
          <p className="mb-3 text-xs text-zinc-500">
            These removed players still have history. If one is just an old spelling of a current player, merge them to
            move everything across.
          </p>
          <MergePlayers teamId={team.id} removed={removed} current={team.players} />
        </Section>
      )}

      <div className="pt-6" aria-hidden />

      {!seasonOver && (
        <Section title="New season" aside="Next season or age group">
          <p className="mb-3 text-sm text-zinc-500">Moving up an age group or into next season’s competition? Set it up here.</p>
          {rollover}
        </Section>
      )}

      {earlier.length > 0 && (
        <Section title="Earlier seasons" aside="MVP points">
          <ul className="space-y-1 text-sm">
            {earlier.map((r) => (
              <li key={r.playerId} className="flex justify-between">
                <span>{nameOf(r.playerId)}</span>
                <span className="font-semibold tabular-nums">{r.points}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="flex items-center justify-center gap-6 pt-2 text-sm text-zinc-500">
        {superAdmin && (
          <Link href="/super" className="underline">
            All teams
          </Link>
        )}
        <form action={adminLogout.bind(null, team.id)}>
          <button className="underline">Lock / sign out</button>
        </form>
      </div>
      </main>
      <TabBar teamId={team.id} active="manager" {...tabs} />
    </div>
  );
}
