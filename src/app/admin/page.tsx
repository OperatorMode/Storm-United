import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { AdminLogin } from "./AdminLogin";
import { ScoreForm } from "./ScoreForm";
import { adminLogout } from "./actions";
import { isAdmin } from "@/lib/session";
import { formatDay, getLeagueData, opponent, votingState } from "@/lib/league";
import { getBallots, getManualScores } from "@/lib/store";
import { tally, winners } from "@/lib/mvp";
import { PLAYERS, playerName } from "@/lib/players";
import { now as clockNow } from "@/lib/clock";

export const metadata: Metadata = { title: "Storm United · Admin", robots: { index: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pt-10">
        <Card title="Admin">
          <AdminLogin />
        </Card>
      </div>
    );
  }

  const [{ ourGames }, ballots, manual] = await Promise.all([getLeagueData(), getBallots(), getManualScores()]);
  const now = clockNow();
  const played = ourGames.filter((g) => g.kickoff.getTime() <= now.getTime());

  const season = tally(ballots);
  const gameWins = new Map<string, number>();
  for (const g of played) {
    if (votingState(g, now) !== "closed") continue;
    for (const w of winners(tally(ballots.filter((b) => b.game_id === g.id)))) {
      gameWins.set(w, (gameWins.get(w) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500">
          ← Back
        </Link>
        <form action={adminLogout}>
          <button className="text-sm text-zinc-500">Lock</button>
        </form>
      </div>

      <Card title="Season MVP" aside="Only you can see this">
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
                <td className="py-2">{playerName(r.playerId)}</td>
                <td className="py-2 text-center">{gameWins.get(r.playerId) ?? 0}</td>
                <td className="py-2 text-right">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Votes by game">
        {played.length === 0 ? (
          <p className="text-sm text-zinc-500">No games played yet.</p>
        ) : (
          <ul className="space-y-4">
            {[...played].reverse().map((g) => {
              const gb = ballots.filter((b) => b.game_id === g.id);
              const t = tally(gb).filter((r) => r.points > 0);
              const voted = new Set(gb.map((b) => b.voter_id));
              const missing = PLAYERS.map((p) => p.id).filter((v) => !voted.has(v));
              return (
                <li key={g.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                      Rd {g.round} vs {opponent(g)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {gb.length} ballots · {votingState(g, now) === "open" ? "open" : "closed"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    {t.length ? t.map((r) => `${playerName(r.playerId)} ${r.points}`).join(" · ") : "No votes"}
                  </div>
                  {missing.length > 0 && (
                    <div className="mt-1 text-xs text-zinc-400">
                      Not voted: {missing.map((v) => playerName(v).split(" ")[0]).join(", ")}
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
                <ScoreForm gameId={g.id} home={g.home} away={g.away} initial={manual[g.id] ?? null} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
