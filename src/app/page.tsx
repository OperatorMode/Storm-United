import { Card } from "@/components/Card";
import { VoterPicker } from "@/components/VoterPicker";
import { AttendanceButtons } from "@/components/AttendanceButtons";
import { BallotForm } from "@/components/BallotForm";
import {
  FINALS_DATE,
  TEAM,
  VOTING_WINDOW_MS,
  formatDay,
  formatDdmmyyyy,
  getLeagueData,
  nextGame,
  opponent,
  ourScore,
  votingState,
  type Game,
} from "@/lib/league";
import { PLAYERS, isPlayerId, playerName } from "@/lib/players";
import { getAttendance, getBallots, type AttendanceRow, type AttendanceStatus } from "@/lib/store";
import { tally, winners } from "@/lib/mvp";
import { currentVoter } from "@/lib/session";
import { now as clockNow } from "@/lib/clock";

export default async function Home() {
  const [{ ourGames, byeRounds, ladder }, attendance, ballots, voter] = await Promise.all([
    getLeagueData(),
    getAttendance(),
    getBallots(),
    currentVoter(),
  ]);
  const now = clockNow();
  const next = nextGame(ourGames, now);
  const myChild = voter && isPlayerId(voter) ? voter : null;
  const statusOf = (gameId: string, playerId: string) =>
    attendance.find((a) => a.game_id === gameId && a.player_id === playerId)?.status ?? null;

  const played = ourGames.filter((g) => g.kickoff.getTime() <= now.getTime()).reverse();
  const openVoting = played.filter((g) => votingState(g, now) === "open");

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="jersey px-4 pb-6 pt-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg border border-white/25 bg-white/10 text-sm font-bold tracking-tight">
              SU
            </div>
            <div className="leading-tight">
              <div className="font-semibold">Storm United</div>
              <div className="text-xs text-white/60">Under 10s · TPP 6 A-Side</div>
            </div>
          </div>
          <VoterPicker current={voter} />
        </div>

        <NextGame game={next} myStatus={myChild && next ? statusOf(next.id, myChild) : null} />
      </header>

      <main className="-mt-2 space-y-4 px-4">
        {!voter && (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Welcome! Who are you?</h2>
            <p className="mb-3 mt-1 text-sm text-zinc-500">
              Pick your child once — this phone will remember it for attendance and MVP votes.
            </p>
            <VoterPicker current={voter} prominent />
          </section>
        )}

        {next && (
          <Card title="Attendance" aside={`Rd ${next.round} · ${formatDay(next.kickoff)}`}>
            {myChild && next.kickoff.getTime() > now.getTime() && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium">Can {playerName(myChild).split(" ")[0]} make it?</p>
                <AttendanceButtons gameId={next.id} status={statusOf(next.id, myChild)} />
              </div>
            )}
            <AttendanceList gameId={next.id} attendance={attendance} highlight={myChild} />
          </Card>
        )}

        <Card title="MVP votes" aside="3 · 2 · 1 points">
          {openVoting.map((g) => {
            const gameBallots = ballots.filter((b) => b.game_id === g.id);
            const mine = voter ? gameBallots.find((b) => b.voter_id === voter) : undefined;
            const candidates = PLAYERS.filter((p) => p.id !== myChild && statusOf(g.id, p.id) !== "no");
            const closes = formatDay(new Date(g.kickoff.getTime() + VOTING_WINDOW_MS));
            return (
              <div key={g.id} className="mb-4 rounded-xl bg-zinc-50 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="font-semibold">vs {opponent(g)}</div>
                  <div className="text-xs text-zinc-500">
                    {gameBallots.length} voted · closes {closes}
                  </div>
                </div>
                {voter ? (
                  <BallotForm
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
                const mvp = state === "closed" ? winners(tally(gameBallots)) : [];
                return (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        Rd {g.round} vs {opponent(g)}
                      </div>
                      <div className="text-xs text-zinc-500">{formatDay(g.kickoff)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      {state === "open" ? (
                        <span className="text-xs text-zinc-500">Voting open</span>
                      ) : mvp.length ? (
                        <span className="font-semibold">🏅 {mvp.map(playerName).join(" & ")}</span>
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

        <Card title="Ladder" aside="U10">
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
                  const us = r.team === TEAM;
                  return (
                    <tr key={r.team} className={us ? "bg-zinc-900 font-semibold text-white" : "border-t border-zinc-100"}>
                      <td className={`py-2 ${us ? "rounded-l-lg pl-2" : ""}`}>{i + 1}</td>
                      <td className="max-w-36 truncate py-2">{r.team}</td>
                      <td className="py-2 text-center">{r.p}</td>
                      <td className="py-2 text-center">{r.w}</td>
                      <td className="py-2 text-center">{r.d}</td>
                      <td className="py-2 text-center">{r.l}</td>
                      <td className="py-2 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td className={`py-2 text-right ${us ? "rounded-r-lg pr-2" : ""}`}>{r.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            3 pts a win, 1 a draw. Top two play the grand final on {formatDdmmyyyy(FINALS_DATE)}.
          </p>
        </Card>

        <Card title="Season fixtures">
          <Fixtures
            games={ourGames}
            byes={byeRounds}
            now={now}
            attendance={attendance}
            myChild={myChild}
          />
        </Card>

        <p className="pt-2 text-center text-xs text-zinc-400">
          Rossiter Pavilion, Piara Waters · Draw &amp; results from{" "}
          <a href="https://tpp-6aside.netlify.app/" className="underline">
            The Proper Player
          </a>
        </p>
      </main>
    </div>
  );
}

function NextGame({ game, myStatus }: { game: Game | null; myStatus: AttendanceStatus | null }) {
  if (!game) {
    return (
      <div className="mt-6">
        <div className="text-xs uppercase tracking-widest text-white/50">Up next</div>
        <div className="mt-1 text-2xl font-semibold">Finals week</div>
        <div className="text-sm text-white/60">{formatDdmmyyyy(FINALS_DATE)} · draw announced after round 9</div>
      </div>
    );
  }
  const home = game.home === TEAM;
  return (
    <div className="mt-6">
      <div className="text-xs uppercase tracking-widest text-white/50">Next game · Round {game.round}</div>
      <div className="mt-1 text-[1.65rem] font-semibold leading-tight">vs {opponent(game)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <Stat label="When" value={formatDay(game.kickoff)} />
        <Stat label="Kick-off" value={game.time} />
        <Stat label="Pitch" value={`${game.pitch} · ${home ? "Home" : "Away"}`} />
      </div>
      {myStatus && (
        <div className="mt-3 text-xs text-white/60">
          You said: <span className="font-medium text-white">{STATUS_LABEL[myStatus]}</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
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
  gameId,
  attendance,
  highlight,
}: {
  gameId: string;
  attendance: AttendanceRow[];
  highlight: string | null;
}) {
  const rows = PLAYERS.map((p) => ({
    player: p,
    status: attendance.find((a) => a.game_id === gameId && a.player_id === p.id)?.status ?? null,
  }));
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
        {rows.map(({ player, status }) => (
          <li key={player.id} className={`flex items-center gap-2 ${player.id === highlight ? "font-semibold" : ""}`}>
            <span className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[status ?? "none"]}`} />
            <span className={`truncate ${status === "no" ? "text-zinc-400 line-through" : ""}`}>{player.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fixtures({
  games,
  byes,
  now,
  attendance,
  myChild,
}: {
  games: Game[];
  byes: { round: number; date: string }[];
  now: Date;
  attendance: AttendanceRow[];
  myChild: string | null;
}) {
  const items = [
    ...games.map((g) => ({ round: g.round, game: g as Game | null, date: g.date })),
    ...byes.map((b) => ({ round: b.round, game: null, date: b.date })),
  ].sort((a, b) => a.round - b.round);

  return (
    <ul className="divide-y divide-zinc-100">
      {items.map(({ round, game, date }) => {
        if (!game) {
          return (
            <li key={`bye-${round}`} className="flex justify-between py-2.5 text-sm text-zinc-400">
              <span>Rd {round} · Bye</span>
              <span className="text-xs">{formatDdmmyyyy(date)}</span>
            </li>
          );
        }
        const res = ourScore(game);
        const upcoming = game.kickoff.getTime() > now.getTime();
        const inCount = attendance.filter((a) => a.game_id === game.id && a.status === "yes").length;
        const mine = myChild ? attendance.find((a) => a.game_id === game.id && a.player_id === myChild)?.status : null;
        const row = (
          <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">
                Rd {round} · {game.home === TEAM ? "vs" : "@"} {opponent(game)}
              </div>
              <div className="text-xs text-zinc-500">
                {formatDay(game.kickoff)} · {game.time} · Pitch {game.pitch}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {res ? (
                <ResultBadge us={res.us} them={res.them} />
              ) : upcoming ? (
                <span className="text-xs text-zinc-500">
                  {inCount}/{PLAYERS.length} in
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
                <AttendanceButtons gameId={game.id} status={mine ?? null} />
              </div>
            </details>
          </li>
        );
      })}
      <li className="flex justify-between py-2.5 text-sm text-zinc-500">
        <span>Week 10 · Finals &amp; placings</span>
        <span className="text-xs">{formatDdmmyyyy(FINALS_DATE)}</span>
      </li>
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
