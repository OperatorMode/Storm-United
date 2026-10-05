import { getTeam, slugify, teamIdForJoinCode, type Team } from "./teams";

// Finds a team from what someone typed: its join code, or its name / link.
// `byCode` says whether the join code itself was given (and so proves access).
export async function lookupTeam(input: string): Promise<{ team: Team; byCode: boolean } | null> {
  const byCode = await teamIdForJoinCode(input);
  if (byCode) {
    const team = await getTeam(byCode);
    if (team) return { team, byCode: true };
  }
  const slug = slugify(input.replace(/^.*sidelnr\.app\//i, ""));
  const team = slug ? await getTeam(slug) : null;
  return team ? { team, byCode: false } : null;
}
