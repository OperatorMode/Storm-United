import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

// All persistence goes through here, server-side only. In production that's
// Supabase (service-role key, never sent to the browser). Without Supabase env
// vars, i.e. local dev, it falls back to a JSON file in .data/ so the app is
// usable before the database is connected.
//
// Everything is scoped by team id (the URL slug).

export type AttendanceStatus = "yes" | "no" | "maybe";
// Which half a player has volunteered to keep goal ("full" = whole game).
// A special-role sign-up: "full", or part numbers like "1,4" (older rows: "1st"/"2nd"). See role.ts.
export type GoalieHalf = string;
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

export type TeamRow = {
  id: string;
  name: string;
  league_name: string; // the team's name in its competition's fixtures
  division: string; // legacy (pre-competitions); kept for older rows
  competition_id: string | null;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  admin_pin_hash: string | null;
  join_code_hash: string | null;
  join_code_key: string | null; // unsalted lookup hash of the join code (see teams.ts)
  meet_minutes: number;
  goalie_enabled: boolean; // the special role (see role.ts) is on
  role_name?: string | null; // its name; null = "Goalie". Migration 013.
  game_parts?: number | null; // how a game is split: 2 halves, 4 quarters, 9 innings... Migration 014.
  part_name?: string | null; // "Half", "Quarter", "Period", "Inning", "Set", "Game"
  mute_league?: boolean; // the team turned off its league's announcements. Migration 017.
};
export type PlayerRow = { id: string; name: string; sort: number; active: boolean };

type Scoped<T> = T & { team_id: string };
export type LocalDb = {
  teams: TeamRow[];
  players: Scoped<PlayerRow>[];
  attendance: Scoped<AttendanceRow>[];
  ballots: Scoped<BallotRow>[];
  scores: Scoped<{ game_id: string; home: number; away: number }>[];
  leagues?: LeagueRow[];
  competitions?: CompetitionRow[];
  // User-created leagues (see fixtures.ts).
  league_admins?: { league_id: string; manager_id: string; created_at: string }[];
  competition_teams?: { competition_id: string; name: string; created_at: string }[];
  fixtures?: FixtureRow[];
  // Manager accounts (see accounts.ts).
  managers?: { id: string; email: string; name: string | null; created_at: string }[];
  team_managers?: { team_id: string; manager_id: string; role: "owner" | "manager"; created_at: string }[];
  login_tokens?: { token_hash: string; email: string; expires_at: string; used_at: string | null; created_at: string }[];
  // Messaging (see messages.ts); optional so older local files still load.
  announcements?: { id: string; team_id: string; body: string; created_at: string; source?: string | null }[];
  league_claims?: import("./league-verify").LeagueClaim[];
  households?: { id: string; share_code_hash: string | null; share_expires_at: string | null; created_at: string }[];
  activities?: import("./activities").Activity[];
  household_push?: import("./activity-reminders").HouseholdPush[];
  activity_reminder_log?: { household_id: string; key: string; sent_at: string }[];
  league_messages?: { id: string; league_id: string; competition_id: string | null; audience: "all" | "managers"; body: string; teams: number; created_at: string }[];
  acks?: { announcement_id: string; player_id: string; created_at: string }[];
  chat?: { id: string; team_id: string; author_id: string; body: string; created_at: string }[];
  subs?: PushSubRow[];
  // Game alerts (see game-alerts.ts).
  game_state?: { team_id: string; games: GameSnapshot; updated_at: string }[];
  notification_log?: { team_id: string; key: string; sent_at: string }[];
  // Coach tools (training.ts, duties.ts, rotation.ts).
  training?: import("./training").TrainingRow[];
  team_duties?: { team_id: string; name: string; sort: number }[];
  duty_signups?: { team_id: string; game_id: string; duty: string; player_id: string; created_at: string }[];
  game_rotations?: { team_id: string; game_id: string; plan: unknown; updated_at: string }[];
};

export type LeagueRow = {
  id: string;
  name: string;
  short_name: string | null;
  website: string | null;
  venue: string | null;
  source: "tpp" | "manual";
  timezone?: string;
  created_by?: string | null;
  verified_at?: string | null; // official: may send league announcements. Migration 017.
  verified_by?: string | null; // the official email it was verified with, or "review"
};

export type FixtureRow = {
  id: string;
  competition_id: string;
  round: number | null;
  stage: string | null;
  kickoff: string; // ISO timestamp
  pitch: string | null;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "postponed" | "cancelled";
};

export type CompetitionRow = {
  id: string;
  league_id: string;
  name: string;
  season: string | null;
  kind: "season" | "tournament";
  source_key: string | null;
  points_win: number;
  points_draw: number;
  ladder_last_round: number | null;
  finals_date: string | null; // yyyy-mm-dd
  finals_note: string | null;
  // Fixtures pulled from a link (see feeds.ts); absent before migration 008.
  feed_type?: "csv" | "ics" | "web" | null;
  feed_url?: string | null;
  feed_filter?: string | null;
  feed_team?: string | null;
  feed_synced_at?: string | null;
  feed_error?: string | null;
  feed_hash?: string | null;
  // 'wins': ranked by wins and losses (basketball); else by points. Migration 011.
  ladder_style?: "points" | "wins" | null;
  // A linked league's own ladder page, and the table read from it. Migration 012.
  ladder_url?: string | null;
  ladder_table?: import("./feeds").OfficialLadder | null;
  ladder_hash?: string | null;
  ladder_checked_at?: string | null; // last time the ladder page was read. Migration 015.
};

export type PushSubRow = {
  endpoint: string;
  team_id: string;
  author_id: string | null;
  p256dh: string;
  auth: string;
  notify_board: boolean;
  notify_chat: boolean;
  notify_games?: boolean; // time/pitch changes, postponed, cancelled
  notify_reminders?: boolean; // "can your child play?" and match-day reminders
  children?: string | null; // player ids this phone picked, comma-separated
};

/** A team's upcoming games at the last alert check: game id -> details. */
export type GameSnapshot = Record<string, { k: string; p: string | null; t: string; o: string }>;

let supabase: SupabaseClient | null = null;
export function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.VERCEL) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return null;
  }
  supabase ??= createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

// Local dev seed mirrors supabase/migrations/001_multi_team.sql.
const LOCAL_SEED: LocalDb = {
  teams: [
    {
      id: "storm-united",
      name: "Storm United",
      league_name: "Storm United",
      division: "U10",
      competition_id: "tpp-2026-u10",
      primary_color: "#0a0a0a",
      accent_color: "#e5334b",
      logo_url: "/brand/crest.svg",
      admin_pin_hash: null,
      join_code_hash: null,
      join_code_key: null,
      meet_minutes: 30,
      goalie_enabled: true,
    },
  ],
  players: ["Benjamin B.", "Brooklyn L.", "Erik J.", "Khushmeet G.", "Rayygan K.", "Ryan L.", "Viaan V.", "Zane B."].map(
    (name, sort) => ({ team_id: "storm-united", id: name.split(" ")[0].toLowerCase(), name, sort, active: true }),
  ),
  attendance: [],
  ballots: [],
  scores: [],
  leagues: [
    {
      id: "tpp-6aside-2026",
      name: "TPP 6 A-Side League 2026",
      short_name: "TPP 6 A-Side",
      website: "https://tpp-6aside.netlify.app/",
      venue: "Rossiter Pavilion, Piara Waters",
      source: "tpp",
    },
  ],
  competitions: (["U8", "U10", "U12", "U14"] as const).map((d) => ({
    id: `tpp-2026-${d.toLowerCase()}`,
    league_id: "tpp-6aside-2026",
    name: `Under ${d.slice(1)}s`,
    season: "2026",
    kind: "season" as const,
    source_key: d,
    points_win: 3,
    points_draw: 1,
    ladder_last_round: 9,
    finals_date: "2026-12-14",
    finals_note: "Top two play the grand final in week 10.",
  })),
};

const LOCAL_FILE = path.join(process.cwd(), ".data", "local-db.json");
export async function readLocal(): Promise<LocalDb> {
  try {
    return { ...structuredClone(LOCAL_SEED), ...JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")) };
  } catch {
    return structuredClone(LOCAL_SEED);
  }
}
export async function writeLocal(data: LocalDb) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2));
}

export function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const strip = <T extends { team_id: string }>({ team_id: _, ...rest }: T) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars

// ---------- teams & players ----------

const TEAM_COLS =
  "id, name, league_name, division, competition_id, primary_color, accent_color, logo_url, admin_pin_hash, join_code_hash, join_code_key, meet_minutes, goalie_enabled, role_name, game_parts, part_name, mute_league";

export async function listTeams(): Promise<TeamRow[]> {
  const s = db();
  if (!s) return (await readLocal()).teams;
  return check(await s.from("teams").select(TEAM_COLS).order("name"));
}

export async function getTeamRow(id: string): Promise<TeamRow | null> {
  const s = db();
  if (!s) return (await readLocal()).teams.find((t) => t.id === id) ?? null;
  return check(await s.from("teams").select(TEAM_COLS).eq("id", id).maybeSingle());
}

// ---------- leagues & competitions ----------

const COMPETITION_COLS =
  "id, league_id, name, season, kind, source_key, points_win, points_draw, ladder_last_round, finals_date, finals_note, feed_type, feed_url, feed_filter, feed_team, feed_synced_at, feed_error, feed_hash, ladder_style, ladder_url, ladder_table, ladder_checked_at";

export async function listLeagues(): Promise<LeagueRow[]> {
  const s = db();
  if (!s) return (await readLocal()).leagues ?? [];
  return check(await s.from("leagues").select("id, name, short_name, website, venue, source, timezone, created_by, verified_at, verified_by").order("name"));
}

export async function listCompetitionRows(): Promise<CompetitionRow[]> {
  const s = db();
  if (!s) return (await readLocal()).competitions ?? [];
  return check(await s.from("competitions").select(COMPETITION_COLS).order("id"));
}

export async function findTeamIdByJoinKey(key: string): Promise<string | null> {
  const s = db();
  if (!s) return (await readLocal()).teams.find((t) => t.join_code_key === key)?.id ?? null;
  const row = check(await s.from("teams").select("id").eq("join_code_key", key).maybeSingle()) as { id: string } | null;
  return row?.id ?? null;
}

export async function upsertTeam(team: TeamRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.teams = [...data.teams.filter((t) => t.id !== team.id), team];
    return writeLocal(data);
  }
  check(await s.from("teams").upsert(team, { onConflict: "id" }));
}

export async function deleteTeam(id: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.teams = data.teams.filter((t) => t.id !== id);
    for (const k of ["players", "attendance", "ballots", "scores"] as const) {
      (data[k] as { team_id: string }[]) = data[k].filter((r) => r.team_id !== id);
    }
    return writeLocal(data);
  }
  check(await s.from("teams").delete().eq("id", id)); // cascades to players/attendance/ballots/scores
}

export async function getPlayers(teamId: string): Promise<PlayerRow[]> {
  const s = db();
  const rows = s
    ? check(await s.from("players").select("id, name, sort, active").eq("team_id", teamId))
    : (await readLocal()).players.filter((p) => p.team_id === teamId).map(strip);
  return rows.sort((a, b) => a.sort - b.sort);
}

export async function savePlayers(teamId: string, players: PlayerRow[]): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.players = [...data.players.filter((p) => p.team_id !== teamId), ...players.map((p) => ({ ...p, team_id: teamId }))];
    return writeLocal(data);
  }
  if (players.length) {
    check(await s.from("players").upsert(players.map((p) => ({ ...p, team_id: teamId })), { onConflict: "team_id,id" }));
  }
}

// Stores an uploaded logo and returns its public URL.
export async function uploadLogo(teamId: string, file: File): Promise<string> {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" }[file.type] ?? "png";
  const name = `${teamId}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const s = db();
  if (!s) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
    return `/uploads/${name}`;
  }
  check(await s.storage.from("logos").upload(name, bytes, { contentType: file.type, upsert: true }));
  return s.storage.from("logos").getPublicUrl(name).data.publicUrl;
}

// ---------- attendance, ballots, scores ----------

export async function getAttendance(teamId: string): Promise<AttendanceRow[]> {
  const s = db();
  if (!s) {
    return (await readLocal()).attendance
      .filter((r) => r.team_id === teamId)
      .map((r) => ({ ...strip(r), goalie: r.goalie ?? null }));
  }
  return check(await s.from("attendance").select("game_id, player_id, status, goalie").eq("team_id", teamId));
}

export async function setAttendance(teamId: string, row: AttendanceRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.attendance = data.attendance.filter(
      (r) => !(r.team_id === teamId && r.game_id === row.game_id && r.player_id === row.player_id),
    );
    data.attendance.push({ ...row, team_id: teamId });
    return writeLocal(data);
  }
  check(
    await s
      .from("attendance")
      .upsert(
        { ...row, team_id: teamId, updated_at: new Date().toISOString() },
        { onConflict: "team_id,game_id,player_id" },
      ),
  );
}

export async function getBallots(teamId: string): Promise<BallotRow[]> {
  const s = db();
  if (!s) return (await readLocal()).ballots.filter((r) => r.team_id === teamId).map(strip);
  return check(await s.from("ballots").select("game_id, voter_id, first, second, third").eq("team_id", teamId));
}

export async function upsertBallot(teamId: string, row: BallotRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.ballots = data.ballots.filter(
      (r) => !(r.team_id === teamId && r.game_id === row.game_id && r.voter_id === row.voter_id),
    );
    data.ballots.push({ ...row, team_id: teamId });
    return writeLocal(data);
  }
  check(
    await s
      .from("ballots")
      .upsert(
        { ...row, team_id: teamId, updated_at: new Date().toISOString() },
        { onConflict: "team_id,game_id,voter_id" },
      ),
  );
}

export async function getManualScores(teamId: string): Promise<ManualScores> {
  const s = db();
  const rows = s
    ? check(await s.from("manual_scores").select("game_id, home, away").eq("team_id", teamId))
    : (await readLocal()).scores.filter((r) => r.team_id === teamId);
  return Object.fromEntries(rows.map((r) => [r.game_id, { home: r.home, away: r.away }]));
}

export async function setManualScore(
  teamId: string,
  gameId: string,
  score: { home: number; away: number } | null,
): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.scores = data.scores.filter((r) => !(r.team_id === teamId && r.game_id === gameId));
    if (score) data.scores.push({ team_id: teamId, game_id: gameId, ...score });
    return writeLocal(data);
  }
  if (score) {
    check(
      await s
        .from("manual_scores")
        .upsert({ team_id: teamId, game_id: gameId, ...score }, { onConflict: "team_id,game_id" }),
    );
  } else {
    check(await s.from("manual_scores").delete().eq("team_id", teamId).eq("game_id", gameId));
  }
}
