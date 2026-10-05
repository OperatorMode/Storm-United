import type { SourceData, SourceGame } from "./types";

// TPP 6 A-Side League (tpp-6aside.netlify.app): the draw is a static data.js
// file, results a public Firebase feed keyed by game id ({ h, a }) that the
// league updates on the night. `division` is TPP's code, e.g. "U10".
const DRAW_URL = "https://tpp-6aside.netlify.app/data.js";
const RESULTS_URL =
  "https://tpp-mindset-default-rtdb.asia-southeast1.firebasedatabase.app/sixaside2026/public.json";

type RawGame = { id: string; round: number; date: string; time: string; pitch: number; div: string; home: string; away: string };
type RawDraw = {
  teams: Record<string, { name: string }[]>;
  games: RawGame[];
  byes: { round: number; div: string; team: string }[];
  dates: { round: number; date: string }[];
};

// Perth is UTC+8 all year (no daylight saving).
export function perthKickoff(date: string, time: string): Date {
  const [d, m, y] = date.split("/").map(Number);
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  let h = match ? Number(match[1]) % 12 : 0;
  const min = match ? Number(match[2]) : 0;
  if (match && match[3].toLowerCase() === "pm") h += 12;
  return new Date(Date.UTC(y, m - 1, d, h - 8, min));
}

async function fetchDraw(): Promise<RawDraw> {
  const res = await fetch(DRAW_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TPP draw fetch failed: ${res.status}`);
  const text = await res.text();
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as RawDraw;
}

async function fetchResults(): Promise<Record<string, { h: number; a: number }>> {
  try {
    const res = await fetch(RESULTS_URL, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    return (await res.json()) ?? {};
  } catch {
    return {};
  }
}

export async function loadTpp(division: string): Promise<SourceData> {
  const [draw, results] = await Promise.all([fetchDraw(), fetchResults()]);
  const games: SourceGame[] = draw.games
    .filter((g) => g.div === division)
    .map((g) => {
      const r = results[g.id];
      const score =
        r && Number.isFinite(Number(r.h)) && Number.isFinite(Number(r.a)) ? { home: Number(r.h), away: Number(r.a) } : null;
      return {
        id: g.id,
        round: g.round,
        kickoff: perthKickoff(g.date, g.time),
        timeLabel: g.time,
        pitch: String(g.pitch),
        home: g.home,
        away: g.away,
        score,
      };
    });
  const dateOf = new Map(draw.dates.map((d) => [d.round, d.date]));
  return {
    teams: (draw.teams[division] ?? []).map((t) => t.name),
    games,
    byes: draw.byes
      .filter((b) => b.div === division)
      .map((b) => {
        const d = dateOf.get(b.round);
        return { round: b.round, team: b.team, date: d ? perthKickoff(d, "12:00 pm") : null };
      }),
  };
}
