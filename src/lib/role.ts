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

// ---------- how a game is split: halves, quarters, innings... ----------

export type GameParts = { count: number; name: string }; // e.g. { count: 9, name: "Inning" }

export const PART_PRESETS: { name: string; count: number | null; label: string }[] = [
  { name: "Half", count: 2, label: "2 halves" },
  { name: "Quarter", count: 4, label: "4 quarters" },
  { name: "Period", count: 3, label: "3 periods" },
  { name: "Inning", count: null, label: "Innings" },
  { name: "Set", count: null, label: "Sets" },
  { name: "Game", count: 1, label: "One block (no breaks)" },
];

export function gameParts(team: { game_parts?: number | null; part_name?: string | null }): GameParts {
  const count = Math.min(12, Math.max(1, Math.round(team.game_parts ?? 2)));
  return { count, name: team.part_name?.trim() || "Half" };
}

const ORDINAL = ["1st", "2nd", "3rd"];

/** One part's name: "1st half", "Q3", "Inning 4" (short: "1st", "Q3", "Inn 4"). */
export function partLabel(i: number, gp: GameParts, short = false): string {
  const n = i + 1;
  switch (gp.count === 1 ? "Game" : gp.name) {
    case "Game":
      return "Game";
    case "Half":
      return gp.count === 2 ? (short ? ORDINAL[i] : `${ORDINAL[i]} half`) : `${short ? "H" : "Half "}${n}`;
    case "Quarter":
      return `Q${n}`;
    case "Period":
      return short ? `P${n}` : `Period ${n}`;
    case "Inning":
      return short ? `Inn ${n}` : `Inning ${n}`;
    case "Set":
      return short ? `S${n}` : `Set ${n}`;
    default:
      return `${gp.name} ${n}`;
  }
}

/** "halves", "quarters", "innings". */
export function partPlural(gp: GameParts): string {
  const name = gp.name.toLowerCase();
  return name === "half" ? "halves" : name.endsWith("s") ? name : `${name}s`;
}

// A role sign-up (stored on the attendance row): "full", or the part numbers
// ("1,4,7"). Older rows say "1st" / "2nd".

/** The parts (0-based) a sign-up covers. */
export function slotParts(slot: string | null | undefined, count: number): number[] {
  if (!slot) return [];
  if (slot === "full") return [...Array(count).keys()];
  if (slot === "1st") return [0];
  if (slot === "2nd") return count > 1 ? [1] : [0];
  return [...new Set(slot.split(",").map((x) => Number(x) - 1))].filter((x) => Number.isInteger(x) && x >= 0 && x < count).sort((a, b) => a - b);
}

/** The sign-up for these parts: null for none, "full" for all. */
export function slotFrom(parts: number[], count: number): string | null {
  const list = [...new Set(parts)].filter((x) => x >= 0 && x < count).sort((a, b) => a - b);
  if (!list.length) return null;
  if (list.length === count) return "full";
  return list.map((x) => x + 1).join(",");
}

/** Whether a stored sign-up is well formed. */
export function isSlot(slot: string): boolean {
  return /^(full|1st|2nd|[0-9]{1,2}(,[0-9]{1,2})*)$/.test(slot);
}

/** "Full", "1st", "Inn 1, Inn 4". */
export function slotLabel(slot: string, gp: GameParts): string {
  const parts = slotParts(slot, gp.count);
  if (parts.length === gp.count) return "Full";
  return parts.map((p) => partLabel(p, gp, true)).join(", ");
}
