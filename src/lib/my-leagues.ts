import { adminLeagueIds } from "./fixtures";
import { listCompetitions, type Competition } from "./league";

// Leagues (and events, leagues whose competitions are one-day events) that a
// manager administers.
export type ManagedLeague = { id: string; name: string; competitions: Competition[]; isEvent: boolean };

export async function managedLeagues(managerId: string): Promise<ManagedLeague[]> {
  const [ids, competitions] = await Promise.all([adminLeagueIds(managerId), listCompetitions()]);
  return [...new Set(ids)].flatMap((id) => {
    const comps = competitions.filter((c) => c.league_id === id);
    if (!comps.length) return [];
    // Read from a league's own website: not run in Sidelnr, unless it's official (announcements, by request).
    if (comps.every((c) => c.feed_type === "web") && !comps[0].league.verified_at) return [];
    return [{ id, name: comps[0].league.name, competitions: comps, isEvent: comps.every((c) => c.kind === "tournament") }];
  });
}
