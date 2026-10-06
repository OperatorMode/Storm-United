import { zonedTime, type ImportedFixture } from "./fixtures";
import { roundRobin } from "./events";

// Builds a whole season's fixtures from a few answers (the fixture wizard):
// when the season runs, which days and hours games can be played, where, and
// how long a game takes. One round per week; a round's games are spread over
// the selected days, time slots and pitches.

export type DrawSettings = {
  start: string; // yyyy-mm-dd
  end: string;
  breaks: { from: string; to: string }[];
  meetings: number; // times each pair of teams meets
  finalsWeeks: number; // weeks kept free at the end
  days: number[]; // 0 = Sunday … 6 = Saturday
  windowStart: string; // HH:MM, first possible kick-off
  windowEnd: string; // HH:MM, every game finished by
  venueMode: "single" | "home";
  venue: string; // single venue name (optional)
  pitches: string; // single venue: "3" or "1, 2, Main"
  homeGrounds: Record<string, string>; // home mode: team -> ground
  groundPitches: number; // home mode: pitches at each ground
  periods: number; // 2 halves, 4 quarters…
  periodMinutes: number;
  breakMinutes: number; // all breaks in a game together (e.g. half-time)
  changeover: number; // minutes between games on a pitch
};

export type DrawResult = {
  fixtures: ImportedFixture[];
  errors: string[]; // the draw can't be made as asked
  warnings: string[]; // it can, but worth knowing
  summary: {
    teams: number;
    rounds: number;
    weeksAvailable: number;
    gamesPerRound: number;
    slotMinutes: number;
    slotsPerVenueDay: number;
    lastRound: string | null; // yyyy-mm-dd
  };
};

const DAY_MS = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayOf = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const weekday = (iso: string) => new Date(dayOf(iso)).getUTCDay();
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const pairKey = (a: string, b: string) => [a, b].sort().join("\u0000");

/** Pitch names from "3" (→ 1, 2, 3) or "1, 2, Main". */
export function pitchNames(input: string): string[] {
  const t = input.trim();
  if (/^\d+$/.test(t)) return Array.from({ length: Math.min(Number(t), 50) }, (_, i) => String(i + 1));
  return t.split(",").map((p) => p.trim()).filter(Boolean);
}

/** The play dates of each week: selected weekdays, outside the breaks. */
function playWeeks(s: DrawSettings): string[][] {
  const weeks = new Map<number, string[]>();
  for (let t = dayOf(s.start); t <= dayOf(s.end); t += DAY_MS) {
    const iso = isoDay(t);
    if (!s.days.includes(weekday(iso))) continue;
    if (s.breaks.some((b) => b.from && b.to && iso >= b.from && iso <= b.to)) continue;
    const monday = t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS; // weeks run Monday–Sunday
    weeks.set(monday, [...(weeks.get(monday) ?? []), iso]);
  }
  return [...weeks.values()];
}

/**
 * Picks the home team of each game so everyone gets an even share of home
 * games, and as few home (or away) games in a row as possible.
 */
function balanceHome(rounds: [string, string][][]): [string, string][][] {
  const homes = new Map<string, number>();
  const lastHome = new Map<string, boolean>();
  return rounds.map((games) =>
    games.map(([a, b]) => {
      const score = (t: string) => (homes.get(t) ?? 0) * 2 + (lastHome.get(t) ? 1 : 0);
      const [h, w] = score(a) <= score(b) ? [a, b] : [b, a];
      homes.set(h, (homes.get(h) ?? 0) + 1);
      lastHome.set(h, true);
      lastHome.set(w, false);
      return [h, w] as [string, string];
    }),
  );
}

export function buildSeasonDraw(
  teams: string[],
  s: DrawSettings,
  opts: { timeZone: string; played?: { home: string; away: string }[]; roundOffset?: number },
): DrawResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const gameMinutes = s.periods * s.periodMinutes + s.breakMinutes;
  const slotMinutes = gameMinutes + s.changeover;
  const first = minutesOf(s.windowStart);
  const last = minutesOf(s.windowEnd);
  const times: number[] = [];
  for (let t = first; t + gameMinutes <= last; t += slotMinutes) times.push(t);

  const summary: DrawResult["summary"] = {
    teams: teams.length,
    rounds: 0,
    weeksAvailable: 0,
    gamesPerRound: Math.floor(teams.length / 2),
    slotMinutes,
    slotsPerVenueDay: times.length,
    lastRound: null,
  };
  if (teams.length < 2) errors.push("Add at least two teams first.");
  if (!s.days.length) errors.push("Pick the day(s) games are played.");
  if (!(s.start && s.end) || s.end < s.start) errors.push("Check the season’s start and end dates.");
  if (gameMinutes <= 0) errors.push("Enter how long a game is.");
  if (!times.length && gameMinutes > 0) errors.push(`A ${gameMinutes}-minute game doesn’t fit in the time window.`);

  // Venues: one shared venue, or each home team's ground.
  const venues = new Map<string, string[]>(); // venue -> pitch labels
  const venueFor = (home: string) => (s.venueMode === "single" ? "main" : (s.homeGrounds[home] ?? "").trim());
  if (s.venueMode === "single") {
    const pitches = pitchNames(s.pitches);
    if (!pitches.length) errors.push("Enter how many pitches there are.");
    venues.set("main", pitches);
  } else {
    const missing = teams.filter((t) => !venueFor(t));
    if (missing.length) errors.push(`Add a home ground for ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}.`);
    const n = Math.max(1, Math.min(20, Math.round(s.groundPitches) || 1));
    for (const t of teams) {
      const g = venueFor(t);
      if (g && !venues.has(g)) venues.set(g, n === 1 ? [g] : Array.from({ length: n }, (_, i) => `${g} · Pitch ${i + 1}`));
    }
  }
  if (errors.length) return { fixtures: [], errors, warnings, summary };

  // Rounds: everyone plays everyone, `meetings` times, home and away swapped
  // each time round. Games already played are taken out.
  const once = balanceHome(roundRobin(teams));
  let rounds: [string, string][][] = [];
  for (let m = 0; m < Math.max(1, s.meetings); m++) {
    rounds.push(...once.map((r) => r.map(([h, a]) => (m % 2 ? [a, h] : [h, a]) as [string, string])));
  }
  if (opts.played?.length) {
    const left = new Map<string, number>();
    for (const p of opts.played) left.set(pairKey(p.home, p.away), (left.get(pairKey(p.home, p.away)) ?? 0) + 1);
    rounds = rounds
      .map((r) =>
        r.filter(([h, a]) => {
          const n = left.get(pairKey(h, a)) ?? 0;
          if (n > 0) left.set(pairKey(h, a), n - 1);
          return n === 0;
        }),
      )
      .filter((r) => r.length);
  }
  summary.rounds = rounds.length;

  const weeks = playWeeks(s);
  const usable = weeks.slice(0, Math.max(0, weeks.length - Math.max(0, s.finalsWeeks)));
  summary.weeksAvailable = usable.length;
  if (rounds.length > usable.length) {
    errors.push(
      `${rounds.length} rounds need ${rounds.length} weeks, but only ${usable.length} are available${s.finalsWeeks ? ` (after ${s.finalsWeeks} finals week${s.finalsWeeks > 1 ? "s" : ""})` : ""}. Extend the season, shorten a break, or play teams fewer times.`,
    );
    return { fixtures: [], errors, warnings, summary };
  }
  if (usable.length > rounds.length) {
    warnings.push(`${usable.length - rounds.length} spare week${usable.length - rounds.length > 1 ? "s" : ""} at the end, handy for washed-out games.`);
  }

  // Fairness: a team that kicked off late gets an early slot next time, and
  // games are spread across pitches.
  const lateness = new Map<string, number>(teams.map((t) => [t, 0]));
  const pitchUse = new Map<string, number>();
  const used = (team: string, pitch: string) => pitchUse.get(`${team}\u0000${pitch}`) ?? 0;
  const fixtures: ImportedFixture[] = [];
  let unscheduled = 0;

  rounds.forEach((games, r) => {
    const dates = usable[r];
    if (r === rounds.length - 1) summary.lastRound = dates[dates.length - 1];
    const byVenue = new Map<string, [string, string][]>();
    for (const g of games) byVenue.set(venueFor(g[0]), [...(byVenue.get(venueFor(g[0])) ?? []), g]);

    for (const [venue, venueGames] of byVenue) {
      const pitches = venues.get(venue)!;
      const queue = [...venueGames].sort(
        ([h1, a1], [h2, a2]) => lateness.get(h2)! + lateness.get(a2)! - (lateness.get(h1)! + lateness.get(a1)!),
      );
      let rank = 0;
      for (const date of dates) {
        for (const time of times) {
          if (!queue.length) break;
          const now = queue.splice(0, pitches.length);
          const free = [...pitches];
          for (const [h, a] of now) {
            free.sort((p, q) => used(h, p) + used(a, p) - (used(h, q) + used(a, q)));
            const pitch = free.shift()!;
            for (const t of [h, a]) {
              pitchUse.set(`${t}\u0000${pitch}`, used(t, pitch) + 1);
              lateness.set(t, lateness.get(t)! + rank);
            }
            fixtures.push({
              round: (opts.roundOffset ?? 0) + r + 1,
              stage: null,
              kickoff: zonedTime(date, hhmm(time), opts.timeZone).toISOString(),
              pitch: s.venueMode === "single" && s.venue.trim() && pitches.length === 1 ? s.venue.trim() : pitch,
              home: h,
              away: a,
              home_score: null,
              away_score: null,
            });
          }
          rank++;
        }
      }
      unscheduled += queue.length;
    }
  });

  if (unscheduled) {
    errors.push(
      `${unscheduled} game${unscheduled > 1 ? "s don’t" : " doesn’t"} fit: ${times.length} slot${times.length > 1 ? "s" : ""} a day isn’t enough. Add pitches, another day, or widen the time window.`,
    );
  }
  return { fixtures, errors, warnings, summary };
}
