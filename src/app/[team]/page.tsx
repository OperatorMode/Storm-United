import { Card } from "@/components/Card";
import { VoterPicker } from "@/components/VoterPicker";
import { InstallPrompt } from "@/components/InstallPrompt";
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
import { getAttendance, getBallots, type AttendanceRow, type AttendanceStatus, type GoalieHalf } from "@/lib/store";
import { tally, winners } from "@/lib/mvp";
import { canView, currentVoter } from "@/lib/session";
import { now as clockNow } from "@/lib/clock";

export default async function TeamHome({ params }: PageProps<"/[team]">) {
  const team = await getTeam((await params).team);
  if (!team) notFound();
  if (!(await canView(team))) return <JoinGate team={team} />;

  const [{ competition, tz, ourGames, byeRounds, ladder, ladderTitle }, attendance, ballots, voter, tabs] = await Promise.all([
    getLeagueData(team),
    getAttendance(team.id),
    getBallots(team.id),
    currentVoter(team),
    tabData(team),
  ]);
  const us = team.league_name;
  const PLAYERS = team.players;
  const nameOf = (id: string) => playerName(team, id);
  const now = clockNow();
  const next = nextGame(ourGames, now);
  const myChild = voter;
  const rowOf = (gameId: string, playerId: string) =>
    attendance.find((a) => a.game_id === gameId && a.player_id === playerId);
  const statusOf = (gameId: string, playerId: string) => rowOf(gameId, playerId)?.status ?? null;

  const played = ourGames.filter((g) => g.kickoff.getTime() <= now.getTime()).reverse();
  const openVoting = played.filter((g) => votingState(g, now) === "open");

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="jersey px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc(team)} alt={`${team.name} logo`} className="size-12 shrink-0 object-contain" />
            <div className="leading-tight">
              <div className="font-semibold">{team.name}</div>
              <div className="text-xs text-on-team/60">{competition ? competitionLabel(competition) : team.division}</div>
            </div>
          </div>
          <VoterPicker teamId={team.id} players={PLAYERS} current={voter} />
        </div>

        <NextGame team={team} competition={competition} game={next} myStatus={myChild && next ? statusOf(next.id, myChild) : null} />
      </header>

      <main className="-mt-2 space-y-4 px-4">
        <InstallPrompt name={team.name} icon={`/${team.id}/icon/192`} />
        {!voter && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Welcome! Who are you?</h2>
            <p className="mb-3 mt-1 text-sm text-zinc-500">
              Pick your child once and this phone will remember it for attendance and MVP votes.
            </p>
            <VoterPicker teamId={team.id} players={PLAYERS} current={voter} prominent />
          </section>
        )}

        {next && (
          <Card title="Attendance" aside={`${roundLabel(next)} · ${formatDay(next.kickoff, tz)}`}>
            {myChild && next.kickoff.getTime() > now.getTime() && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium">Can {firstName(nameOf(myChild))} make it?</p>
                <AttendanceButtons
                  teamId={team.id}
                  goalieEnabled={team.goalie_enabled}
                  gameId={next.id}
                  status={statusOf(next.id, myChild)}
                  goalie={rowOf(next.id, myChild)?.goalie ?? null}
                />
              </div>
            )}
            <AttendanceList players={PLAYERS} gameId={next.id} attendance={attendance} highlight={myChild} />
          </Card>
        )}

        <Card title="MVP votes" aside="3 · 2 · 1 points">
          {openVoting.map((g) => {
            const gameBallots = ballots.filter((b) => b.game_id === g.id);
            const mine = myChild ? gameBallots.find((b) => b.voter_id === voter) : undefined;
            const candidates = PLAYERS.filter((p) => p.id !== myChild && statusOf(g.id, p.id) !== "no");
            const closes = formatDay(new Date(g.kickoff.getTime() + VOTING_WINDOW_MS), tz);
            return (
              <div key={g.id} className="mb-4 rounded-xl bg-zinc-50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="font-semibold">vs {opponent(g, us)}</div>
                  <div className="text-xs text-zinc-500">
                    {gameBallots.length} voted · closes {closes}
                  </div>
                </div>
                {myChild ? (
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

        <Card title={ladderTitle ?? "Ladder"} aside={competition?.name}>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="w-6 py-1.5 font-medium">#</th>
                  <th className="py-1.5 font-medium">Team</th>
                  <th className="py-1.5 text-center font-medium">P</th>
                  <th className="py-1.5 text-center font-medium">W</th>
                  <th className="py-1.5 text-center font-medium">D</th>
                  <th className="py-1.5 text-center font-medium">L</th>
                  <th className="py-1.5 text-center font-medium">GD</th>
                  <th className="py-1.5 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ladder.map((r, i) => {
                  const mine = r.team === us;
                  return (
                    <tr key={r.team} className={mine ? "bg-team font-semibold text-on-team" : "border-t border-zinc-100"}>
                      <td className={`py-2 ${mine ? "rounded-l-lg pl-2" : ""}`}>{i + 1}</td>
                      <td className="max-w-36 truncate py-2">{mine ? team.name : r.team}</td>
                      <td className="py-2 text-center">{r.p}</td>
                      <td className="py-2 text-center">{r.w}</td>
                      <td className="py-2 text-center">{r.d}</td>
                      <td className="py-2 text-center">{r.l}</td>
                      <td className="py-2 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td className={`py-2 text-right ${mine ? "rounded-r-lg pr-2" : ""}`}>{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            {competition?.points_win ?? 3} pts a win, {competition?.points_draw ?? 1} a draw.
            {competition?.finals_note && ` ${competition.finals_note}`}
          </p>
        </Card>

        <Card title="Season fixtures">
          <Fixtures
            team={team}
            competition={competition}
            games={ourGames}
            byes={byeRounds}
            now={now}
            attendance={attendance}
            myChild={myChild}
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
      </main>
      <TabBar teamId={team.id} active="home" {...tabs} />
    </div>
  );
}

function NextGame({
  team,
  competition,
  game,
  myStatus,
}: {
  team: Team;
  competition: Competition | null;
  game: Game | null;
  myStatus: AttendanceStatus | null;
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
      {myStatus && (
        <div className="mt-3 text-xs text-on-team/60">
          You said: <span className="font-medium text-on-team">{STATUS_LABEL[myStatus]}</span>
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
const GOALIE_LABEL: Record<GoalieHalf, string> = { "1st": "1st", "2nd": "2nd", full: "FT" };
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
}: {
  players: { id: string; name: string }[];
  gameId: string;
  attendance: AttendanceRow[];
  highlight: string | null;
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
          <li key={player.id} className={`flex items-center gap-2 ${player.id === highlight ? "font-semibold" : ""}`}>
            <span className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status ?? "none"]}`} />
            <span className={`truncate ${status === "no" ? "text-zinc-400 line-through" : ""}`}>{player.name}</span>
            {goalie && (
              <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                Goalie: {GOALIE_LABEL[goalie]}
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
  myChild,
}: {
  team: Team;
  competition: Competition | null;
  games: Game[];
  byes: { round: number; date: Date | null }[];
  now: Date;
  attendance: AttendanceRow[];
  myChild: string | null;
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
        const myRow = myChild ? attendance.find((a) => a.game_id === game.id && a.player_id === myChild) : undefined;
        const mine = myRow?.status ?? null;
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
                  {mine && <span className={`ml-1.5 inline-block size-2 rounded-full ${STATUS_DOT[mine]}`} />}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">Awaiting score</span>
              )}
            </div>
          </div>
        );
        if (!upcoming || !myChild) return <li key={game.id}>{row}</li>;
        return (
          <li key={game.id}>
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{row}</summary>
              <div className="pb-3">
                <AttendanceButtons
                  teamId={team.id}
                  goalieEnabled={team.goalie_enabled}
                  gameId={game.id}
                  status={mine}
                  goalie={myRow?.goalie ?? null}
                />
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
