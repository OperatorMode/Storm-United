import { Card } from "@/components/Card";
import { gameParts, roleName, slotLabel, type GameParts } from "@/lib/role";
import { OfficialLadderTable } from "@/components/OfficialLadderTable";
import { SidelnrLink } from "@/components/SidelnrLink";
import { ChildrenPicker } from "@/components/ChildrenPicker";
import { LeaveTeam } from "@/components/LeaveTeam";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationSettings } from "@/components/NotificationSettings";
import { pushPublicKey } from "@/lib/push";
import { AddToCalendar } from "@/components/AddToCalendar";
import { TrainingButtons } from "@/components/TrainingButtons";
import { DutyList } from "@/components/DutyList";
import { listDuties, listDutySignups } from "@/lib/duties";
import { listTraining } from "@/lib/training";
import { formatTime } from "@/lib/time";
import { calendarToken } from "@/lib/calendar";
import { headers } from "next/headers";
import { AttendanceButtons } from "@/components/AttendanceButtons";
import { BallotForm } from "@/components/BallotForm";
import {
  competitionLabel,
  competitionTz,
  roundLabel,
  pitchLabel,
  gamePlace,
  VOTING_WINDOW_MS,
  formatDay,
  formatIsoDate,
  getLeagueData,
  meetingTime,
  nextGame,
  opponent,
  ourScore,
  votingState,
  type Competition,
  type Game,
} from "@/lib/league";
import { notFound } from "next/navigation";
import { Directions } from "@/components/Directions";
import { JoinGate } from "@/components/JoinGate";
import { TabBar } from "@/components/TabBar";
import { tabData } from "@/lib/tabs";
import { firstName, getTeam, playerName, type Team } from "@/lib/teams";
import { logoSrc } from "@/lib/brand";
import { getAttendance, getBallots, type AttendanceRow, type AttendanceStatus } from "@/lib/store";
import { tally, winners } from "@/lib/mvp";
import { adminAccess, canView, currentChildren, isPlayerSelf } from "@/lib/session";
import { now as clockNow } from "@/lib/clock";
import { PhoneCheckIn } from "@/components/PhoneCheckIn";

export default async function TeamHome({ params }: PageProps<"/[team]">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [{ competition, tz, ourGames, byeRounds, ladder, ladderTitle, ladderStyle, officialLadder }, attendance, ballots, children, tabs] = await Promise.all([
    getLeagueData(team),
    getAttendance(team.id),
    getBallots(team.id),
    currentChildren(team),
    tabData(team),
  ]);
  const self = await isPlayerSelf(team);
  const byWins = ladderStyle === "wins";
  const [calToken, host, training, duties, dutySignups] = await Promise.all([
    calendarToken([team]),
    headers().then((h) => h.get("host") ?? "sidelnr.app"),
    listTraining(team.id),
    listDuties(team.id),
    listDutySignups(team.id),
  ]);
  const family = (playerId: string) => `${firstName(playerName(team, playerId))}’s family`;
  const voter = children[0] ?? null; // the family's id (one MVP ballot per family)
  const us = team.league_name;
  const PLAYERS = team.players;
  const nameOf = (id: string) => playerName(team, id);
  const now = clockNow();
  const next = nextGame(ourGames, now);
  const rowOf = (gameId: string, playerId: string) =>
    attendance.find((a) => a.game_id === gameId && a.player_id === playerId);
  const statusOf = (gameId: string, playerId: string) => rowOf(gameId, playerId)?.status ?? null;

  const played = ourGames.filter((g) => g.kickoff.getTime() <= now.getTime()).reverse();
  const openVoting = played.filter((g) => votingState(g, now) === "open");

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="jersey px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <SidelnrLink />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc(team)} alt={`${team.name} logo`} className="size-12 shrink-0 object-contain" />
            <div className="leading-tight">
              <div className="font-semibold">{team.name}</div>
              <div className="text-xs text-on-team/60">{competition ? competitionLabel(competition) : team.division}</div>
            </div>
          </div>
          <ChildrenPicker teamId={team.id} players={PLAYERS} current={children} self={self} />
        </div>

        <NextGame
          team={team}
          competition={competition}
          game={next}
          myStatuses={next ? children.flatMap((c) => (statusOf(next.id, c) ? [{ name: firstName(nameOf(c)), status: statusOf(next.id, c)! }] : [])) : []}
        />
      </header>

      <main className="-mt-2 space-y-4 px-4">
        <InstallPrompt name={team.name} icon={`/${team.id}/icon/192`} />
        <PhoneCheckIn teamId={team.id} />
        {children.length > 0 && <NotificationSettings teamId={team.id} vapidKey={pushPublicKey()} />}
        {calToken && children.length > 0 && <AddToCalendar host={host} path={`/cal/${calToken}.ics`} />}
        {!voter && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Welcome! Who are you?</h2>
            <p className="mb-3 mt-1 text-sm text-zinc-500">
              Tap your name, or your child’s, and this phone will remember it for attendance and MVP votes.
            </p>
            <ChildrenPicker teamId={team.id} players={PLAYERS} current={children} self={self} inline />
          </section>
        )}

        {next && (
          <Card title="Attendance" aside={`${roundLabel(next)} · ${formatDay(next.kickoff, tz)}`}>
            {next.kickoff.getTime() > now.getTime() &&
              children.map((child) => (
                <div key={child} className="mb-4">
                  <p className="mb-2 text-sm font-medium">Can {firstName(nameOf(child))} make it?</p>
                  <AttendanceButtons
                    teamId={team.id}
                    playerId={child}
                    goalieEnabled={team.goalie_enabled}
                    roleName={roleName(team)}
                    gameParts={gameParts(team)}
                    gameId={next.id}
                    status={statusOf(next.id, child)}
                    goalie={rowOf(next.id, child)?.goalie ?? null}
                  />
                </div>
              ))}
            <AttendanceList players={PLAYERS} gameId={next.id} attendance={attendance} highlight={children} role={roleName(team)} parts={gameParts(team)} />
          </Card>
        )}

        {duties.length > 0 &&
          (() => {
            const games = ourGames.filter((g) => g.kickoff.getTime() > now.getTime() && g.time !== "Postponed").slice(0, 3);
            if (!games.length) return null;
            return (
              <Card title="Duties" aside="Thanks for helping out">
                <div className="space-y-3">
                  {games.map((g) => (
                    <div key={g.id}>
                      <div className="text-xs font-semibold text-zinc-500">
                        {formatDay(g.kickoff, tz)} · {g.home === us ? "vs" : "@"} {opponent(g, us)}
                      </div>
                      <DutyList
                        teamId={team.id}
                        gameId={g.id}
                        canTake={children.length > 0}
                        slots={duties.map((duty) => {
                          const taken = dutySignups.find((d) => d.game_id === g.id && d.duty === duty);
                          return { duty, takenBy: taken ? family(taken.player_id) : null, mine: !!taken && children.includes(taken.player_id) };
                        })}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

        {(() => {
          const upcomingTraining = training
            .filter((t) => new Date(t.starts_at).getTime() + t.minutes * 60_000 > now.getTime())
            .slice(0, 3);
          if (!upcomingTraining.length) return null;
          return (
            <Card title="Training" aside={training.some((t) => t.series_id) ? "Weekly" : undefined}>
              <ul className="space-y-4">
                {upcomingTraining.map((t) => {
                  const start = new Date(t.starts_at);
                  const started = start.getTime() <= now.getTime();
                  const coming = PLAYERS.filter((p) => statusOf(t.id, p.id) === "yes").length;
                  return (
                    <li key={t.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`font-semibold ${t.cancelled ? "text-zinc-400 line-through" : ""}`}>
                            {formatDay(start, tz)}, {formatTime(start, tz)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {t.minutes} min{t.location ? ` · ${t.location}` : ""}
                            {!t.cancelled && ` · ${coming}/${PLAYERS.length} coming`}
                          </div>
                          {t.note && <div className="mt-0.5 text-xs text-zinc-600">{t.note}</div>}
                        </div>
                        {t.cancelled ? (
                          <span className="shrink-0 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">Cancelled</span>
                        ) : (
                          t.location && <Directions place={t.location} className="shrink-0 bg-zinc-900 text-white" />
                        )}
                      </div>
                      {!t.cancelled && !started && children.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {children.map((child) => (
                            <div key={child}>
                              {children.length > 1 && <p className="mb-1 text-xs font-medium text-zinc-600">{firstName(nameOf(child))}</p>}
                              <TrainingButtons teamId={team.id} sessionId={t.id} playerId={child} status={statusOf(t.id, child)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })()}

        <Card title="MVP votes" aside="3 · 2 · 1 points">
          {openVoting.map((g) => {
            const gameBallots = ballots.filter((b) => b.game_id === g.id);
            const mine = voter ? gameBallots.find((b) => b.voter_id === voter) : undefined;
            const candidates = PLAYERS.filter((p) => !children.includes(p.id) && statusOf(g.id, p.id) !== "no");
            const closes = formatDay(new Date(g.kickoff.getTime() + VOTING_WINDOW_MS), tz);
            return (
              <div key={g.id} className="mb-4 rounded-xl bg-zinc-50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="font-semibold">vs {opponent(g, us)}</div>
                  <div className="text-xs text-zinc-500">
                    {gameBallots.length} voted · closes {closes}
                  </div>
                </div>
                {voter ? (
                  <BallotForm
                    teamId={team.id}
                    gameId={g.id}
                    candidates={candidates}
                    existing={mine ? [mine.first, mine.second, mine.third] : null}
                  />
                ) : (
                  <p className="text-sm text-zinc-500">Pick who you are (top right) to vote.</p>
                )}
              </div>
            );
          })}

          {played.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Voting opens at kick-off of each game and stays open for 48 hours.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {played.map((g) => {
                const state = votingState(g, now);
                const gameBallots = ballots.filter((b) => b.game_id === g.id);
                const mvp = state === "closed" ? winners(tally(gameBallots, PLAYERS.map((p) => p.id))) : [];
                return (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {roundLabel(g)} vs {opponent(g, us)}
                      </div>
                      <div className="text-xs text-zinc-500">{formatDay(g.kickoff, tz)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {state === "open" ? (
                        <span className="text-xs text-zinc-500">Voting open</span>
                      ) : mvp.length ? (
                        <span className="font-semibold">MVP: {mvp.map(nameOf).join(" & ")}</span>
                      ) : (
                        <span className="text-xs text-zinc-400">No votes</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {officialLadder ? (
          <Card title="Ladder" aside={competition?.name}>
            <OfficialLadderTable ladder={officialLadder} us={us} ourName={team.name} tz={tz} />
          </Card>
        ) : (
        <Card title={ladderTitle ?? "Ladder"} aside={competition?.name}>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="w-6 py-1.5 font-medium">#</th>
                  <th className="py-1.5 font-medium">Team</th>
                  {(byWins ? ["GP", "W", "L", "Pts+", "Pts-"] : ["P", "W", "D", "L", "GD"]).map((h) => (
                    <th key={h} className="py-1.5 text-center font-medium">
                      {h}
                    </th>
                  ))}
                  <th className="py-1.5 text-right font-medium">{byWins ? "Diff" : "Pts"}</th>
                </tr>
              </thead>
              <tbody>
                {ladder.map((r, i) => {
                  const mine = r.team === us;
                  return (
                    <tr key={r.team} className={mine ? "bg-team font-semibold text-on-team" : "border-t border-zinc-100"}>
                      <td className={`py-2 ${mine ? "rounded-l-lg pl-2" : ""}`}>{i + 1}</td>
                      <td className="max-w-36 truncate py-2">{mine ? team.name : r.team}</td>
                      {(byWins ? [r.p, r.w, r.l, r.gf, r.ga] : [r.p, r.w, r.d, r.l, r.gd > 0 ? `+${r.gd}` : r.gd]).map((v, k) => (
                        <td key={k} className="py-2 text-center">
                          {v}
                        </td>
                      ))}
                      <td className={`py-2 text-right ${mine ? "rounded-r-lg pr-2" : ""}`}>
                        {byWins ? (r.gd > 0 ? `+${r.gd}` : r.gd) : r.pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {byWins
              ? "Ranked by wins, then points difference."
              : `${competition?.points_win ?? 3} pts a win, ${competition?.points_draw ?? 1} a draw.`}
            {competition?.finals_note && ` ${competition.finals_note}`}
          </p>
        </Card>
        )}

        <Card title="Season fixtures">
          <Fixtures
            team={team}
            competition={competition}
            games={ourGames}
            byes={byeRounds}
            now={now}
            attendance={attendance}
            myChildren={children}
          />
        </Card>

        {competition && (
          <p className="pt-2 text-center text-xs text-zinc-400">
            {competition.league.venue && `${competition.league.venue} · `}
            Draw &amp; results from{" "}
            {competition.league.website ? (
              <a href={competition.league.website} className="underline">
                {competition.league.name}
              </a>
            ) : (
              competition.league.name
            )}
          </p>
        )}

        <div className="pt-4 text-center">
          <LeaveTeam
            teamId={team.id}
            teamName={team.name}
            managing={(await adminAccess(team)) === "manager"}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-600"
          />
        </div>
      </main>
      <TabBar teamId={team.id} active="home" {...tabs} />
    </div>
  );
}

function NextGame({
  team,
  competition,
  game,
  myStatuses,
}: {
  team: Team;
  competition: Competition | null;
  game: Game | null;
  myStatuses: { name: string; status: AttendanceStatus }[];
}) {
  const tz = competitionTz(competition);
  if (!game) {
    const finals = competition?.finals_date && competition.finals_date >= new Date().toISOString().slice(0, 10);
    return (
      <div className="mt-6">
        <div className="text-xs uppercase tracking-widest text-on-team/50">Up next</div>
        <div className="mt-1 text-2xl font-semibold">{finals ? "Finals" : "No games scheduled"}</div>
        {finals && (
          <div className="text-sm text-on-team/60">
            {formatIsoDate(competition!.finals_date!, tz)} · draw to be announced
          </div>
        )}
      </div>
    );
  }
  const home = game.home === team.league_name;
  const place = gamePlace(game.pitch, competition);
  return (
    <div className="mt-6">
      <div className="text-xs uppercase tracking-widest text-on-team/50">Next game · {roundLabel(game, true)}</div>
      <div className="mt-1 text-[1.65rem] font-semibold leading-tight">vs {opponent(game, team.league_name)}</div>
      {team.meet_minutes > 0 && (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-zinc-950">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Meeting time</div>
          <div className="text-xl font-semibold leading-tight">{meetingTime(game, team.meet_minutes, tz)}</div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          Warm-up &amp;
          <br />
          short practice
        </div>
      </div>
      )}
      <div className={`${team.meet_minutes > 0 ? "mt-2" : "mt-4"} grid grid-cols-3 gap-2 text-sm`}>
        <Stat label="When" value={formatDay(game.kickoff, tz)} />
        <Stat label="Kick-off" value={game.time} />
        <Stat label="Pitch" value={`${game.pitch} · ${home ? "Home" : "Away"}`} />
      </div>
      {place && (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-on-team/60">
          <span className="truncate">{place}</span>
          <Directions place={place} className="shrink-0 bg-accent text-on-accent" />
        </div>
      )}
      {myStatuses.length > 0 && (
        <div className="mt-3 text-xs text-on-team/60">
          You said:{" "}
          {myStatuses.map((m, i) => (
            <span key={m.name}>
              {i > 0 && " · "}
              {myStatuses.length > 1 && `${m.name}: `}
              <span className="font-medium text-on-team">{STATUS_LABEL[m.status]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-on-team/15 bg-on-team/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-on-team/50">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

const STATUS_LABEL: Record<AttendanceStatus, string> = { yes: "Can play", maybe: "Maybe", no: "Can't make it" };
const STATUS_DOT: Record<AttendanceStatus | "none", string> = {
  yes: "bg-emerald-500",
  maybe: "bg-amber-400",
  no: "bg-zinc-900",
  none: "bg-zinc-200",
};

function AttendanceList({
  players,
  gameId,
  attendance,
  highlight,
  role,
  parts,
}: {
  players: { id: string; name: string }[];
  gameId: string;
  attendance: AttendanceRow[];
  highlight: string[];
  role: string;
  parts: GameParts;
}) {
  const rows = players.map((p) => {
    const row = attendance.find((a) => a.game_id === gameId && a.player_id === p.id);
    return { player: p, status: row?.status ?? null, goalie: row?.goalie ?? null };
  });
  const count = (s: AttendanceStatus | null) => rows.filter((r) => r.status === s).length;
  return (
    <div>
      <div className="mb-2 flex gap-3 text-xs text-zinc-600">
        <span><b className="text-zinc-900">{count("yes")}</b> in</span>
        <span><b className="text-zinc-900">{count("maybe")}</b> maybe</span>
        <span><b className="text-zinc-900">{count("no")}</b> out</span>
        <span><b className="text-zinc-900">{count(null)}</b> no reply</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        {rows.map(({ player, status, goalie }) => (
          <li key={player.id} className={`flex items-center gap-2 ${highlight.includes(player.id) ? "font-semibold" : ""}`}>
            <span className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status ?? "none"]}`} />
            <span className={`truncate ${status === "no" ? "text-zinc-400 line-through" : ""}`}>{player.name}</span>
            {goalie && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                {role}: {slotLabel(goalie, parts)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fixtures({
  team,
  competition,
  games,
  byes,
  now,
  attendance,
  myChildren,
}: {
  team: Team;
  competition: Competition | null;
  games: Game[];
  byes: { round: number; date: Date | null }[];
  now: Date;
  attendance: AttendanceRow[];
  myChildren: string[];
}) {
  const tz = competitionTz(competition);
  const items = [
    ...games.map((g) => ({ round: g.round, game: g as Game | null, date: g.kickoff as Date | null })),
    ...byes.map((b) => ({ round: b.round as number | null, game: null, date: b.date })),
  ].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || (a.round ?? 0) - (b.round ?? 0));

  return (
    <ul className="divide-y divide-zinc-100">
      {items.map(({ round, game, date }) => {
        if (!game) {
          return (
            <li key={`bye-${round}`} className="flex justify-between py-2.5 text-sm text-zinc-400">
              <span>Rd {round} · Bye</span>
              <span className="text-xs">{date ? formatDay(date, tz) : ""}</span>
            </li>
          );
        }
        const us = team.league_name;
        const res = ourScore(game, us);
        const upcoming = game.kickoff.getTime() > now.getTime();
        // Count the current squad only (same as the Attendance card): rows for
        // players who've since been removed are kept for history but don't count.
        const inCount = team.players.filter((p) =>
          attendance.some((a) => a.game_id === game.id && a.player_id === p.id && a.status === "yes"),
        ).length;
        const rowFor = (child: string) => attendance.find((a) => a.game_id === game.id && a.player_id === child);
        const mine = myChildren.map((c) => rowFor(c)?.status ?? null);
        const row = (
          <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">
                {roundLabel(game)} · {game.home === us ? "vs" : "@"} {opponent(game, us)}
              </div>
              <div className="text-xs text-zinc-500">
                {formatDay(game.kickoff, tz)}
                {team.meet_minutes > 0 && ` · Meet ${meetingTime(game, team.meet_minutes, tz)}`} · KO {game.time}
                {game.pitch && ` · ${pitchLabel(game.pitch)}`}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {res ? (
                <ResultBadge us={res.us} them={res.them} />
              ) : upcoming ? (
                <span className="text-xs text-zinc-500">
                  {inCount}/{team.players.length} in
                  {mine.map((m, i) => m && <span key={i} className={`ml-1.5 inline-block size-2 rounded-full ${STATUS_DOT[m]}`} />)}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">Awaiting score</span>
              )}
            </div>
          </div>
        );
        if (!upcoming || !myChildren.length) return <li key={game.id}>{row}</li>;
        return (
          <li key={game.id}>
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{row}</summary>
              <div className="space-y-3 pb-3">
                {myChildren.map((child) => (
                  <div key={child}>
                    {myChildren.length > 1 && (
                      <p className="mb-1.5 text-xs font-medium text-zinc-600">{firstName(playerName(team, child))}</p>
                    )}
                    <AttendanceButtons
                      teamId={team.id}
                      playerId={child}
                      goalieEnabled={team.goalie_enabled}
                    roleName={roleName(team)}
                    gameParts={gameParts(team)}
                      gameId={game.id}
                      status={rowFor(child)?.status ?? null}
                      goalie={rowFor(child)?.goalie ?? null}
                    />
                  </div>
                ))}
              </div>
            </details>
          </li>
        );
      })}
      {competition?.finals_date && (
        <li className="flex justify-between py-2.5 text-sm text-zinc-500">
          <span>Finals &amp; placings</span>
          <span className="text-xs">{formatIsoDate(competition.finals_date, tz)}</span>
        </li>
      )}
    </ul>
  );
}

function ResultBadge({ us, them }: { us: number; them: number }) {
  const r = us > them ? "W" : us < them ? "L" : "D";
  const style = r === "W" ? "bg-emerald-600 text-white" : r === "L" ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-700";
  return (
    <span className="inline-flex items-center gap-2 font-semibold tabular-nums">
      {us}–{them}
      <span className={`grid size-5 place-items-center rounded text-[11px] ${style}`}>{r}</span>
    </span>
  );
}
