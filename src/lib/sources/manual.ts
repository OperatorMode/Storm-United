import { listCompetitionTeamNames, listFixtures } from "../fixtures";
import type { SourceData, SourceGame } from "./types";

// Fixtures typed in or uploaded by a league admin (fixtures table).

const TIME = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", hour: "numeric", minute: "2-digit", hour12: true });
const timeLabel = (d: Date) => TIME.format(d).replace(/\s*([ap])\.?m\.?/i, " $1m").toLowerCase();

export async function loadManual(competitionId: string): Promise<SourceData> {
  const [teamNames, fixtures] = await Promise.all([listCompetitionTeamNames(competitionId), listFixtures(competitionId)]);
  const live = fixtures.filter((f) => f.status !== "cancelled");

  const games: SourceGame[] = live.map((f) => {
    const kickoff = new Date(f.kickoff);
    return {
      id: f.id,
      round: f.round,
      kickoff,
      timeLabel: f.status === "postponed" ? "Postponed" : timeLabel(kickoff),
      pitch: f.pitch,
      home: f.home,
      away: f.away,
      score: f.home_score !== null && f.away_score !== null ? { home: f.home_score, away: f.away_score } : null,
    };
  });

  const teams = [...new Set([...teamNames, ...live.flatMap((f) => [f.home, f.away])])];

  // A team with no game in a numbered round has a bye that round.
  const rounds = new Map<number, Date>();
  for (const g of games) {
    if (g.round === null) continue;
    const first = rounds.get(g.round);
    if (!first || g.kickoff < first) rounds.set(g.round, g.kickoff);
  }
  const byes = [...rounds.entries()].flatMap(([round, date]) => {
    const playing = new Set(games.filter((g) => g.round === round).flatMap((g) => [g.home, g.away]));
    return teams.filter((t) => !playing.has(t)).map((team) => ({ round, date, team }));
  });

  return { teams, games, byes };
}
