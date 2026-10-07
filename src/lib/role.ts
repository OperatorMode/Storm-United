// A team's special role: the player who does a particular job for part or all
// of a game (goalie, catcher, bowler, wicket keeper...). Turned on per team.

export const DEFAULT_ROLE = "Goalie";

/** The role's name as the team set it, e.g. "Catcher". */
export function roleName(team: { role_name?: string | null }): string {
  return team.role_name?.trim() || DEFAULT_ROLE;
}

/** "Goalies", "Catchers"; a name already ending in s stays as is. */
export function rolePlural(name: string): string {
  return /s$/i.test(name) ? name : `${name}s`;
}

/** For the middle of a sentence: "goalie", but "MVP" stays as typed. */
export function roleInText(name: string): string {
  return name === name.toUpperCase() ? name : name.toLowerCase();
}
