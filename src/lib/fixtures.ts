import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal, type CompetitionRow, type FixtureRow, type LeagueRow } from "./store";

// User-created leagues: competitions, their teams, fixtures and results, and
// who may edit them (league admins). Same pattern as store.ts, Supabase in
// production, a local JSON file in dev.

// ---------- leagues & competitions ----------

export async function createLeague(league: LeagueRow, adminId: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    (d.leagues ??= []).push(league);
    (d.league_admins ??= []).push({ league_id: league.id, manager_id: adminId, created_at: new Date().toISOString() });
    return writeLocal(d);
  }
  check(await s.from("leagues").insert(league));
  check(await s.from("league_admins").insert({ league_id: league.id, manager_id: adminId }));
}

/** Makes this manager the league's only admin (an imported league, once claimed). */
export async function setSoleLeagueAdmin(leagueId: string, managerId: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.league_admins = [...(d.league_admins ?? []).filter((a) => a.league_id !== leagueId), { league_id: leagueId, manager_id: managerId, created_at: new Date().toISOString() }];
    return writeLocal(d);
  }
  check(await s.from("league_admins").delete().eq("league_id", leagueId).neq("manager_id", managerId));
  check(await s.from("league_admins").upsert({ league_id: leagueId, manager_id: managerId }, { onConflict: "league_id,manager_id" }));
}

export async function leagueIdExists(id: string): Promise<boolean> {
  const s = db();
  if (!s) return ((await readLocal()).leagues ?? []).some((l) => l.id === id);
  return !!check(await s.from("leagues").select("id").eq("id", id).maybeSingle());
}

export async function competitionIdExists(id: string): Promise<boolean> {
  const s = db();
  if (!s) return ((await readLocal()).competitions ?? []).some((c) => c.id === id);
  return !!check(await s.from("competitions").select("id").eq("id", id).maybeSingle());
}

export async function upsertCompetition(input: CompetitionRow): Promise<void> {
  // Callers may pass a joined Competition (with `league`); store only the row.
  const { league: _league, ...c } = input as CompetitionRow & { league?: unknown }; // eslint-disable-line @typescript-eslint/no-unused-vars
  const s = db();
  if (!s) {
    const d = await readLocal();
    const prev = (d.competitions ?? []).find((x) => x.id === c.id);
    d.competitions = [...(d.competitions ?? []).filter((x) => x.id !== c.id), { ...prev, ...c }];
    return writeLocal(d);
  }
  check(await s.from("competitions").upsert(c, { onConflict: "id" }));
}

export async function adminLeagueIds(managerId: string): Promise<string[]> {
  const s = db();
  if (!s) return ((await readLocal()).league_admins ?? []).filter((a) => a.manager_id === managerId).map((a) => a.league_id);
  return (check(await s.from("league_admins").select("league_id").eq("manager_id", managerId)) as { league_id: string }[]).map(
    (r) => r.league_id,
  );
}

// ---------- competition teams ----------

export async function listCompetitionTeamNames(competitionId: string): Promise<string[]> {
  const s = db();
  const rows = s
    ? (check(await s.from("competition_teams").select("name").eq("competition_id", competitionId)) as { name: string }[])
    : ((await readLocal()).competition_teams ?? []).filter((t) => t.competition_id === competitionId);
  return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b));
}

export async function addCompetitionTeams(competitionId: string, names: string[]): Promise<void> {
  const clean = [...new Set(names.map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (!clean.length) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    const have = new Set((d.competition_teams ?? []).filter((t) => t.competition_id === competitionId).map((t) => t.name));
    for (const name of clean) {
      if (!have.has(name)) (d.competition_teams ??= []).push({ competition_id: competitionId, name, created_at: new Date().toISOString() });
    }
    return writeLocal(d);
  }
  check(
    await s
      .from("competition_teams")
      .upsert(clean.map((name) => ({ competition_id: competitionId, name })), { onConflict: "competition_id,name", ignoreDuplicates: true }),
  );
}

export async function removeCompetitionTeam(competitionId: string, name: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.competition_teams = (d.competition_teams ?? []).filter((t) => !(t.competition_id === competitionId && t.name === name));
    return writeLocal(d);
  }
  check(await s.from("competition_teams").delete().eq("competition_id", competitionId).eq("name", name));
}

// ---------- fixtures ----------

const FIXTURE_COLS = "id, competition_id, round, stage, kickoff, pitch, home, away, home_score, away_score, status";

export async function listFixtures(competitionId: string): Promise<FixtureRow[]> {
  const s = db();
  const rows = s
    ? (check(await s.from("fixtures").select(FIXTURE_COLS).eq("competition_id", competitionId)) as FixtureRow[])
    : ((await readLocal()).fixtures ?? []).filter((f) => f.competition_id === competitionId);
  return rows.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export async function saveFixtures(rows: FixtureRow[]): Promise<void> {
  if (!rows.length) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    const ids = new Set(rows.map((r) => r.id));
    d.fixtures = [...(d.fixtures ?? []).filter((f) => !ids.has(f.id)), ...rows];
    return writeLocal(d);
  }
  check(await s.from("fixtures").upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "id" }));
}

/** Removes several games at once (a linked league's games that left its source). */
export async function deleteFixtures(competitionId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    const gone = new Set(ids);
    d.fixtures = (d.fixtures ?? []).filter((f) => !(f.competition_id === competitionId && gone.has(f.id)));
    return writeLocal(d);
  }
  check(await s.from("fixtures").delete().eq("competition_id", competitionId).in("id", ids));
}

export async function deleteFixture(competitionId: string, id: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.fixtures = (d.fixtures ?? []).filter((f) => !(f.competition_id === competitionId && f.id === id));
    return writeLocal(d);
  }
  check(await s.from("fixtures").delete().eq("competition_id", competitionId).eq("id", id));
}

export const newFixtureId = () => randomUUID();

// ---------- parsing (CSV import, form input) ----------

// A wall-clock date/time in a timezone -> the UTC instant.
export function zonedTime(dateIso: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asZoned = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asZoned - guess));
}

// "14/12/2026", "14/12/26", "2026-12-14" -> "2026-12-14" (day-first, as in Australia).
export function parseDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

// "5:45 pm", "5.45pm", "17:45", "9am" -> "17:45".
export function parseTime(s: string): string | null {
  const m = s.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Minimal CSV parser (quoted fields, commas or semicolons; Excel "Save as CSV").
export function parseCsv(text: string): string[][] {
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export type ImportedFixture = Omit<FixtureRow, "id" | "competition_id" | "status">;

// Reads fixtures from CSV text with a header row. Recognised columns (any
// order, case-insensitive): Round, Date, Time, Pitch/Venue/Field/Court,
// Home, Away, Home score, Away score, Stage/Pool.
export function fixturesFromCsv(text: string, timeZone: string): { fixtures: ImportedFixture[]; errors: string[] } {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { fixtures: [], errors: ["The file needs a header row and at least one fixture."] };
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const c = {
    round: col("round", "rd", "week"),
    date: col("date", "day"),
    time: col("time", "kickoff", "start", "starttime"),
    pitch: col("pitch", "venue", "field", "court", "ground", "location"),
    home: col("home", "hometeam", "team1"),
    away: col("away", "awayteam", "team2"),
    hs: col("homescore", "hs", "homegoals", "score1"),
    as: col("awayscore", "as", "awaygoals", "score2"),
    stage: col("stage", "pool", "group"),
  };
  const missing = (["date", "time", "home", "away"] as const).filter((k) => c[k] < 0);
  if (missing.length) {
    return { fixtures: [], errors: [`Missing column(s): ${missing.join(", ")}. Download the template to see the layout.`] };
  }
  const fixtures: ImportedFixture[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (k: number) => (k >= 0 ? (r[k] ?? "").trim() : "");
    const date = parseDate(get(c.date));
    const time = parseTime(get(c.time));
    const home = get(c.home).replace(/\s+/g, " ");
    const away = get(c.away).replace(/\s+/g, " ");
    if (!date) return errors.push(`Line ${line}: can’t read the date “${get(c.date)}”.`);
    if (!time) return errors.push(`Line ${line}: can’t read the time “${get(c.time)}”.`);
    if (!home || !away) return errors.push(`Line ${line}: home and away teams are needed.`);
    if (home === away) return errors.push(`Line ${line}: a team can’t play itself.`);
    const round = get(c.round) ? Number(get(c.round).replace(/\D/g, "")) : null;
    const hs = get(c.hs);
    const as = get(c.as);
    fixtures.push({
      round: round !== null && Number.isFinite(round) ? round : null,
      stage: get(c.stage) || null,
      kickoff: zonedTime(date, time, timeZone).toISOString(),
      pitch: get(c.pitch) || null,
      home,
      away,
      home_score: hs !== "" && /^\d+$/.test(hs) ? Number(hs) : null,
      away_score: as !== "" && /^\d+$/.test(as) ? Number(as) : null,
    });
  });
  return { fixtures, errors };
}

// Merges imported fixtures into existing ones, keeping the ids (and so any
// attendance/votes) of fixtures that match on home + away + round/date.
export function mergeImported(competitionId: string, existing: FixtureRow[], imported: ImportedFixture[]): FixtureRow[] {
  const day = (iso: string) => iso.slice(0, 10);
  // The same game: same teams on the same day, or (moved to another day) in the same round.
  const byDay = new Map(existing.map((f) => [`${f.home}|${f.away}|${day(f.kickoff)}`, f]));
  const byRound = new Map(existing.filter((f) => f.round !== null).map((f) => [`${f.home}|${f.away}|${f.round}`, f]));
  const used = new Set<string>();
  return imported.map((f) => {
    const candidates = [byDay.get(`${f.home}|${f.away}|${day(f.kickoff)}`), f.round !== null ? byRound.get(`${f.home}|${f.away}|${f.round}`) : undefined];
    const match = candidates.find((m) => m && !used.has(m.id));
    if (match) used.add(match.id);
    return {
      id: match?.id ?? newFixtureId(),
      competition_id: competitionId,
      status: match?.status ?? "scheduled",
      ...f,
      // A file without scores doesn't wipe results already entered.
      home_score: f.home_score ?? match?.home_score ?? null,
      away_score: f.away_score ?? match?.away_score ?? null,
    };
  });
}

// ---------- deleting (guarded by the callers' triple check) ----------

export async function deleteCompetitionRow(id: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.competitions = (d.competitions ?? []).filter((c) => c.id !== id);
    d.fixtures = (d.fixtures ?? []).filter((f) => f.competition_id !== id);
    d.competition_teams = (d.competition_teams ?? []).filter((t) => t.competition_id !== id);
    return writeLocal(d);
  }
  check(await s.from("competitions").delete().eq("id", id)); // fixtures & competition teams cascade
}

export async function deleteLeagueRow(id: string): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    const comps = new Set((d.competitions ?? []).filter((c) => c.league_id === id).map((c) => c.id));
    d.leagues = (d.leagues ?? []).filter((l) => l.id !== id);
    d.competitions = (d.competitions ?? []).filter((c) => !comps.has(c.id));
    d.fixtures = (d.fixtures ?? []).filter((f) => !comps.has(f.competition_id));
    d.competition_teams = (d.competition_teams ?? []).filter((t) => !comps.has(t.competition_id));
    d.league_admins = (d.league_admins ?? []).filter((a) => a.league_id !== id);
    return writeLocal(d);
  }
  check(await s.from("leagues").delete().eq("id", id)); // competitions, fixtures, admins cascade
}

export async function updateLeague(id: string, patch: Partial<Omit<LeagueRow, "id">>): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.leagues = (d.leagues ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l));
    return writeLocal(d);
  }
  check(await s.from("leagues").update(patch).eq("id", id));
}
