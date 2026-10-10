import { cache } from "react";
import { approvedChildren, listPhones, type TeamPhone } from "./phones";
import { firstName, getTeam, type Team } from "./teams";

// The people in a team, as chat and private messages show them. Every phone
// is one person ("p:<member_id>"):
//  - a player's own phone ("I am…"): "Leo"
//  - anyone else ("I belong to…"): "Leo's Dad", or with a name "Sam (Leo's Friend)".
// Two unnamed people with the same label are numbered: "Leo's Friend (1)", "(2)".
// Older posts were made by a child's id ("Leo's parent") or "coach"; those
// still get their old labels.

export const PERSON_PREFIX = "p:";
export const COACH_ID = "coach";

export const personId = (memberId: string) => `${PERSON_PREFIX}${memberId}`;
export const isPersonId = (id: string) => id.startsWith(PERSON_PREFIX);

export const RELATION_MAX = 24;
export const NAME_MAX = 24;
export const RELATIONS = ["Mum", "Dad", "Grandparent", "Aunty", "Uncle", "Friend"];

/** "Leo", "Leo & Mia", "Leo, Mia & Sam". */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function baseLabel(team: Team, phone: TeamPhone): string {
  const kids = approvedChildren(phone).map((c) => firstName(team.allPlayers.find((p) => p.id === c)?.name ?? "")).filter(Boolean);
  if (phone.is_self) return kids[0] ?? phone.name ?? "A player";
  const rel = phone.relation?.trim() || "family";
  if (!kids.length) return phone.name ? phone.name : `A former ${rel.toLowerCase()}`;
  const who = `${joinNames(kids)}’s ${rel}`;
  return phone.name ? `${phone.name} (${who})` : who;
}

/** Every label in the team: people, the coach and older child-based authors. Cached per request. */
export const teamLabels = cache(async (teamId: string): Promise<Record<string, string>> => {
  const team = await getTeam(teamId);
  if (!team) return {};
  const out: Record<string, string> = { [COACH_ID]: "Coach" };
  for (const p of team.allPlayers) out[p.id] = `${firstName(p.name)}’s parent`;
  const phones = (await listPhones(team.id))
    .filter((p) => p.member_id)
    .sort((a, b) => (a.created_at ?? a.last_seen).localeCompare(b.created_at ?? b.last_seen));
  const bases = phones.map((p) => baseLabel(team, p));
  const seen: Record<string, number> = {};
  const totals: Record<string, number> = {};
  for (const b of bases) totals[b.toLowerCase()] = (totals[b.toLowerCase()] ?? 0) + 1;
  phones.forEach((p, i) => {
    const key = bases[i].toLowerCase();
    seen[key] = (seen[key] ?? 0) + 1;
    out[personId(p.member_id!)] = totals[key] > 1 ? `${bases[i]} (${seen[key]})` : bases[i];
  });
  return out;
});

/** The people others can message privately: everyone except players' own phones, and only phones still following a child. */
export async function messageablePeople(team: Team): Promise<{ id: string; label: string }[]> {
  const labels = await teamLabels(team.id);
  return (await listPhones(team.id))
    .filter((p) => p.member_id && !p.is_self && approvedChildren(p).some((c) => team.players.some((x) => x.id === c)))
    .map((p) => ({ id: personId(p.member_id!), label: labels[personId(p.member_id!)] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const labelOf = (labels: Record<string, string>, id: string) => labels[id] ?? "Someone";
