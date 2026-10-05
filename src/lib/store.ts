import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

// All persistence goes through here, server-side only. In production that's
// Supabase (service-role key, never sent to the browser). Without Supabase env
// vars — i.e. local dev — it falls back to a JSON file in .data/ so the app is
// usable before the database is connected.

export type AttendanceStatus = "yes" | "no" | "maybe";
// Which half a player has volunteered to keep goal ("full" = whole game).
export type GoalieHalf = "1st" | "2nd" | "full";
export type AttendanceRow = {
  game_id: string;
  player_id: string;
  status: AttendanceStatus;
  goalie: GoalieHalf | null;
};
export type BallotRow = {
  game_id: string;
  voter_id: string;
  first: string;
  second: string;
  third: string;
};
export type ManualScores = Record<string, { home: number; away: number }>;

type LocalDb = {
  attendance: AttendanceRow[];
  ballots: BallotRow[];
  scores: { game_id: string; home: number; away: number }[];
};

let supabase: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }
  supabase ??= createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

const LOCAL_FILE = path.join(process.cwd(), ".data", "local-db.json");
async function readLocal(): Promise<LocalDb> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {
    return { attendance: [], ballots: [], scores: [] };
  }
}
async function writeLocal(data: LocalDb) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2));
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getAttendance(): Promise<AttendanceRow[]> {
  const s = db();
  if (!s) return (await readLocal()).attendance.map((r) => ({ ...r, goalie: r.goalie ?? null }));
  return check(await s.from("attendance").select("game_id, player_id, status, goalie"));
}

export async function setAttendance(row: AttendanceRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.attendance = data.attendance.filter(
      (r) => !(r.game_id === row.game_id && r.player_id === row.player_id),
    );
    data.attendance.push(row);
    return writeLocal(data);
  }
  check(
    await s
      .from("attendance")
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "game_id,player_id" }),
  );
}

export async function getBallots(): Promise<BallotRow[]> {
  const s = db();
  if (!s) return (await readLocal()).ballots;
  return check(await s.from("ballots").select("game_id, voter_id, first, second, third"));
}

export async function upsertBallot(row: BallotRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.ballots = data.ballots.filter(
      (r) => !(r.game_id === row.game_id && r.voter_id === row.voter_id),
    );
    data.ballots.push(row);
    return writeLocal(data);
  }
  check(
    await s
      .from("ballots")
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "game_id,voter_id" }),
  );
}

export async function getManualScores(): Promise<ManualScores> {
  const s = db();
  const rows = s
    ? check(await s.from("manual_scores").select("game_id, home, away"))
    : (await readLocal()).scores;
  return Object.fromEntries(rows.map((r) => [r.game_id, { home: r.home, away: r.away }]));
}

export async function setManualScore(
  gameId: string,
  score: { home: number; away: number } | null,
): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.scores = data.scores.filter((r) => r.game_id !== gameId);
    if (score) data.scores.push({ game_id: gameId, ...score });
    return writeLocal(data);
  }
  if (score) {
    check(await s.from("manual_scores").upsert({ game_id: gameId, ...score }, { onConflict: "game_id" }));
  } else {
    check(await s.from("manual_scores").delete().eq("game_id", gameId));
  }
}
