// The team's sport: which field My Game draws, how scoring works, and the
// usual game split and special role (set as defaults when the sport is picked,
// the coach can still change them). No server code here: the phone uses it too.

export type SportId = "soccer" | "basketball" | "afl" | "hockey" | "ice-hockey" | "netball";
export type ScoreKind = { key: string; label: string; points: number };

export type Sport = {
  id: SportId;
  name: string;
  parts: { name: string; count: number }; // the usual split (see PART_PRESETS)
  partMinutes: number; // a usual length of each part, for a first rotation
  role: string | null; // the usual special role (switched on when set)
  onField: number; // players on at once
  kinds: ScoreKind[]; // how a player scores (one kind: a tap on the ball scores it)
  teamScore: ScoreKind | null; // scored for us by the other team (own goal, rushed behind)
  keeper: { x: number; y: number; area: number } | null; // the keeper's spot; lower than `area` counts as in goal
  bench: string; // what the sideline is called
  positions?: { name: string; x: number; y: number }[]; // netball: a bib per position, our goal at the bottom
  tally: string; // the tally's name in Manager's Corner
};

const goal: ScoreKind = { key: "goal", label: "Goal", points: 1 };

export const SPORTS: Sport[] = [
  {
    id: "soccer",
    name: "Soccer",
    parts: { name: "Half", count: 2 },
    partMinutes: 20,
    role: "Goalie",
    onField: 7,
    kinds: [goal],
    teamScore: { key: "own", label: "own goal", points: 1 },
    keeper: { x: 50, y: 90, area: 82 },
    bench: "Sideline",
    tally: "Goals",
  },
  {
    id: "basketball",
    name: "Basketball",
    parts: { name: "Quarter", count: 4 },
    partMinutes: 10,
    role: null,
    onField: 5,
    kinds: [
      { key: "p1", label: "+1", points: 1 },
      { key: "p2", label: "+2", points: 2 },
      { key: "p3", label: "+3", points: 3 },
    ],
    teamScore: null,
    keeper: null,
    bench: "Bench",
    tally: "Points",
  },
  {
    id: "afl",
    name: "AFL",
    parts: { name: "Quarter", count: 4 },
    partMinutes: 12,
    role: null,
    onField: 12,
    kinds: [
      { key: "goal", label: "Goal", points: 6 },
      { key: "behind", label: "Behind", points: 1 },
    ],
    teamScore: { key: "behind", label: "rushed behind", points: 1 },
    keeper: null,
    bench: "Interchange",
    tally: "Goals",
  },
  {
    id: "hockey",
    name: "Hockey",
    parts: { name: "Quarter", count: 4 },
    partMinutes: 12,
    role: "Goalie",
    onField: 7,
    kinds: [goal],
    teamScore: { key: "own", label: "own goal", points: 1 },
    keeper: { x: 50, y: 92, area: 80 },
    bench: "Bench",
    tally: "Goals",
  },
  {
    id: "ice-hockey",
    name: "Ice hockey",
    parts: { name: "Period", count: 3 },
    partMinutes: 15,
    role: "Goalie",
    onField: 6,
    kinds: [goal],
    teamScore: { key: "own", label: "own goal", points: 1 },
    keeper: { x: 50, y: 88, area: 82 },
    bench: "Bench",
    tally: "Goals",
  },
  {
    id: "netball",
    name: "Netball",
    parts: { name: "Quarter", count: 4 },
    partMinutes: 10,
    role: null,
    onField: 7,
    kinds: [goal],
    teamScore: null,
    keeper: null,
    bench: "Bench",
    // Attack at the top, defence at the bottom (our goal).
    positions: [
      { name: "GS", x: 50, y: 8 },
      { name: "GA", x: 28, y: 22 },
      { name: "WA", x: 72, y: 32 },
      { name: "C", x: 50, y: 50 },
      { name: "WD", x: 28, y: 68 },
      { name: "GD", x: 72, y: 78 },
      { name: "GK", x: 50, y: 92 },
    ],
    tally: "Goals",
  },
];

export const DEFAULT_SPORT: SportId = "soccer";

export function sportOf(id: string | null | undefined): Sport {
  return SPORTS.find((s) => s.id === id) ?? SPORTS[0];
}

export const isSportId = (id: unknown): id is SportId => SPORTS.some((s) => s.id === id);

/** A score as the sport shows it: "5.3 (33)" for AFL, otherwise the points. */
export function scoreText(sport: Sport, counts: Record<string, number>): string {
  const pts = sport.kinds.reduce((n, k) => n + (counts[k.key] ?? 0) * k.points, 0);
  return sport.id === "afl" ? `${counts.goal ?? 0}.${counts.behind ?? 0} (${pts})` : String(pts);
}
