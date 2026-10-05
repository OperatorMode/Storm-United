import { competitionTeams, listCompetitions } from "./league";
import { listTeams } from "./store";
import type { CompetitionOption } from "@/components/TeamForm";

// Options for the team form: every competition with the teams in its draw, and
// which draw teams already have a Sidelnr team ("competitionId|team" -> name).
export async function teamFormData(editingId: string | null) {
  const [competitions, teams] = await Promise.all([listCompetitions(), listTeams()]);
  const options: CompetitionOption[] = await Promise.all(
    competitions.map(async (c) => ({ id: c.id, league: c.league.name, name: c.name, teams: await competitionTeams(c.id) })),
  );
  const taken = Object.fromEntries(
    teams.filter((t) => t.id !== editingId).map((t) => [`${t.competition_id}|${t.league_name}`, t.name]),
  );
  return { competitions: options, taken };
}
