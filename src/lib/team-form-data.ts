import { competitionLabel, getCompetition } from "./league";

// The team form finds competitions by searching (see CompetitionPicker); it
// only needs the label of the team's current one.
export async function currentCompetitionLabel(competitionId: string | null): Promise<string | null> {
  const c = competitionId ? await getCompetition(competitionId) : null;
  return c ? competitionLabel(c) : null;
}
