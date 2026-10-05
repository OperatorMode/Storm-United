import { zonedTime, type ImportedFixture } from "./fixtures";

// Events (one-day carnivals / gala days): each division is a competition of
// kind "tournament". Pool games carry their pool in `stage` ("Pool A"); any
// other stage ("Semi-final", "Final") is a finals game.

export const isPoolStage = (stage: string | null | undefined): boolean => !!stage && /^(pool|group)\b/i.test(stage.trim());

/**
 * Reads pools typed one team per line, each pool started by a "Pool …" or
 * "Group …" heading. Without headings, everyone is in "Pool A".
 */
export function parsePools(text: string): { name: string; teams: string[] }[] {
  const pools: { name: string; teams: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) continue;
    if (isPoolStage(line) && line.split(/\s+/).length <= 3) {
      pools.push({ name: line.replace(/:$/, ""), teams: [] });
      continue;
    }
    if (!pools.length) pools.push({ name: "Pool A", teams: [] });
    const pool = pools[pools.length - 1];
    if (!pool.teams.includes(line)) pool.teams.push(line);
  }
  return pools.filter((p) => p.teams.length > 0);
}

/** Round-robin pairings (circle method): everyone plays everyone once. */
export function roundRobin(teams: string[]): [string, string][][] {
  const list: (string | null)[] = [...teams];
  if (list.length % 2) list.push(null); // odd number: one team sits out each round
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const games: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      // Alternate home/away so no team is always "home".
      if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    list.splice(1, 0, list.pop()!); // rotate everyone but the first
  }
  return rounds;
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Lays every pool's games out on the day: `pitches` games at a time, every
 * `slotMinutes`, no team twice in a slot and, where possible, not in two slots
 * in a row.
 */
export function schedulePools(opts: {
  pools: { name: string; teams: string[] }[];
  date: string; // yyyy-mm-dd
  start: string; // HH:MM
  slotMinutes: number;
  pitches: string[];
  timeZone: string;
}): ImportedFixture[] {
  const queue: { stage: string; round: number; home: string; away: string }[] = [];
  const perPool = opts.pools.map((p) => roundRobin(p.teams));
  const maxRounds = Math.max(0, ...perPool.map((r) => r.length));
  for (let r = 0; r < maxRounds; r++) {
    opts.pools.forEach((p, i) => {
      for (const [home, away] of perPool[i][r] ?? []) queue.push({ stage: p.name, round: r + 1, home, away });
    });
  }

  const [h, m] = opts.start.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const out: ImportedFixture[] = [];
  let previous = new Set<string>();
  for (let slot = 0; queue.length; slot++) {
    const busy = new Set<string>();
    const picked: typeof queue = [];
    // First pass: teams who just played get a rest; second pass fills pitches.
    for (const rested of [true, false]) {
      for (const g of queue) {
        if (picked.length >= opts.pitches.length) break;
        if (picked.includes(g) || busy.has(g.home) || busy.has(g.away)) continue;
        if (rested && (previous.has(g.home) || previous.has(g.away))) continue;
        picked.push(g);
        busy.add(g.home).add(g.away);
      }
    }
    if (!picked.length) break; // can't happen, but never loop forever
    const kickoff = zonedTime(opts.date, hhmm(startMinutes + slot * opts.slotMinutes), opts.timeZone).toISOString();
    picked.forEach((g, i) => {
      queue.splice(queue.indexOf(g), 1);
      out.push({ round: g.round, stage: g.stage, kickoff, pitch: opts.pitches[i], home: g.home, away: g.away, home_score: null, away_score: null });
    });
    previous = busy;
  }
  return out;
}
