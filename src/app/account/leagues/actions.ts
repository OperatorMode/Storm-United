"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentManagerId, isSuperAdmin } from "@/lib/session";
import { competitionTz, getCompetition, listCompetitions, pitchLabel } from "@/lib/league";
import { formatDay, formatTime, formatWhen, isTimezone, isoDateIn, minutesOfDay } from "@/lib/time";
import { buildSeasonDraw, type DrawSettings } from "@/lib/season-draw";
import { listTeams } from "@/lib/store";
import { slugify } from "@/lib/teams";
import {
  addCompetitionTeams,
  adminLeagueIds,
  competitionIdExists,
  createLeague,
  deleteCompetitionRow,
  deleteFixture,
  deleteLeagueRow,
  fixturesFromCsv,
  leagueIdExists,
  listCompetitionTeamNames,
  listFixtures,
  mergeImported,
  newFixtureId,
  parseDate,
  parseTime,
  removeCompetitionTeam,
  saveFixtures,
  updateLeague,
  upsertCompetition,
  zonedTime,
} from "@/lib/fixtures";
import type { CompetitionRow } from "@/lib/store";
import { isPoolStage, parsePools, schedulePools } from "@/lib/events";
import { scanLeague, type LeagueScan } from "@/lib/league-scan";
import { guessFeedType, readFeed, saveFeedSettings, syncCompetitionFeed, type FeedSettings, type FeedType } from "@/lib/feeds";
import { after } from "next/server";
import { headers } from "next/headers";
import { addAnnouncement } from "@/lib/messages";
import { notifyManagers, notifyTeam, preview } from "@/lib/push";
import { getManager, teamManagerIds } from "@/lib/accounts";
import { leagueCodeEmail, leagueMessageEmail, sendEmail } from "@/lib/email";
import { confirmEmailClaim, officialDomains, requestReview, startEmailClaim } from "@/lib/league-verify";
import { addLeagueMessage } from "@/lib/league-messages";

const FEED_KIND: Record<FeedType, string> = { csv: "a spreadsheet", ics: "a calendar", web: "a web page, read by AI" };


// Fixture/result changes show up on every team page in the competition.
const refreshAll = () => revalidatePath("/", "layout");

async function uniqueId(base: string, exists: (id: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "league";
  let id = root;
  for (let n = 2; await exists(id); n++) id = `${root}-${n}`;
  return id;
}

// A competition pulled from a link (an official league, a linked sheet) is
// read-only here: its teams, fixtures and results only change at the source.
async function handEditable(competitionId: string) {
  const c = await editableCompetition(competitionId);
  return c && !c.feed_url ? c : null;
}

// League admin of the competition's league, or the super admin.
async function editableCompetition(competitionId: string) {
  const competition = await getCompetition(competitionId);
  if (!competition) return null;
  if (await isSuperAdmin()) return competition;
  const managerId = await currentManagerId();
  if (!managerId) return null;
  return (await adminLeagueIds(managerId)).includes(competition.league_id) ? competition : null;
}

function competitionRow(id: string, leagueId: string, get: (k: string) => string): CompetitionRow | { error: string } {
  const name = get("competition_name");
  if (!name) return { error: "Give the competition a name, e.g. “Under 10s” or “Open”." };
  const win = Number(get("points_win") || 3);
  const draw = Number(get("points_draw") || 1);
  if (![win, draw].every((n) => Number.isInteger(n) && n >= 0 && n <= 10)) return { error: "Points must be whole numbers." };
  const lastRound = get("ladder_last_round");
  const finals = get("finals_date");
  return {
    id,
    league_id: leagueId,
    name,
    season: get("season") || null,
    kind: "season",
    source_key: null,
    points_win: win,
    points_draw: draw,
    ladder_last_round: lastRound ? Number(lastRound) : null,
    finals_date: finals ? parseDate(finals) : null,
    finals_note: get("finals_note") || null,
  };
}

export async function createLeagueAction(_: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("league_name");
  if (!name) return { error: "Give your league a name." };
  const website = get("website");
  if (website && !/^https?:\/\//i.test(website)) return { error: "Website should start with https://" };

  const leagueId = await uniqueId(name, leagueIdExists);
  const competitionId = await uniqueId(`${leagueId}-${get("competition_name") || "main"}`, competitionIdExists);
  const comp = competitionRow(competitionId, leagueId, get);
  if ("error" in comp) return { error: comp.error };

  await createLeague(
    {
      id: leagueId,
      name,
      short_name: get("short_name") || null,
      website: website || null,
      venue: get("venue") || null,
      source: "manual",
      timezone: isTimezone(get("timezone")) ? get("timezone") : "UTC",
      created_by: managerId,
    },
    managerId,
  );
  await upsertCompetition(comp);
  revalidatePath("/account");
  redirect(`/account/competitions/${competitionId}?new=1`);
}

export async function addCompetitionAction(leagueId: string, _: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!(await isSuperAdmin()) && !(managerId && (await adminLeagueIds(managerId)).includes(leagueId))) {
    return { error: "You’re not an admin of this league." };
  }
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const id = await uniqueId(`${leagueId}-${get("competition_name") || "competition"}`, competitionIdExists);
  const comp = competitionRow(id, leagueId, get);
  if ("error" in comp) return { error: comp.error };
  await upsertCompetition(comp);
  revalidatePath("/account");
  redirect(`/account/competitions/${id}?new=1`);
}

export async function saveCompetitionSettings(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const comp = competitionRow(c.id, c.league_id, (k) => String(formData.get(k) ?? "").trim());
  if ("error" in comp) return { error: comp.error };
  await upsertCompetition({ ...c, ...comp, kind: c.kind, source_key: c.source_key });
  refreshAll();
  return { ok: true };
}

export async function addTeamsAction(competitionId: string, _: unknown, formData: FormData) {
  if (!(await handEditable(competitionId))) return { error: "Not authorised." };
  const names = String(formData.get("teams") ?? "").split("\n");
  await addCompetitionTeams(competitionId, names);
  refreshAll();
  return { ok: true };
}

export async function removeTeamAction(competitionId: string, name: string) {
  if (!(await handEditable(competitionId))) return;
  const used = (await listFixtures(competitionId)).some((f) => f.home === name || f.away === name);
  if (used) return { error: `${name} still has fixtures. Delete those first.` };
  await removeCompetitionTeam(competitionId, name);
  refreshAll();
}

export async function addFixtureAction(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const date = parseDate(get("date"));
  const time = parseTime(get("time"));
  const home = get("home");
  const away = get("away");
  if (!date) return { error: "Pick a date." };
  if (!time) return { error: "Enter a kick-off time, e.g. 5:45 pm." };
  if (!home || !away || home === away) return { error: "Pick two different teams." };
  const round = get("round");
  const stage = get("stage") || null;
  await saveFixtures([
    {
      id: newFixtureId(),
      competition_id: competitionId,
      round: round ? Number(round) : null,
      stage,
      kickoff: zonedTime(date, time, competitionTz(c)).toISOString(),
      pitch: get("pitch") || null,
      home,
      away,
      home_score: null,
      away_score: null,
      status: "scheduled",
    },
  ]);
  // Finals games may use placeholders ("Winner Pool A") until pools finish.
  if (!stage || isPoolStage(stage)) await addCompetitionTeams(competitionId, [home, away]);
  refreshAll();
  return { ok: true };
}

// Saves a result (both blank = clear it) and the game's status.
export async function saveResult(
  competitionId: string,
  fixtureId: string,
  home: string,
  away: string,
  status: "scheduled" | "postponed" | "cancelled",
) {
  if (!(await handEditable(competitionId))) return { error: "Not authorised." };
  const fixture = (await listFixtures(competitionId)).find((f) => f.id === fixtureId);
  if (!fixture) return { error: "Game not found." };
  const blank = home.trim() === "" && away.trim() === "";
  const h = Number(home);
  const a = Number(away);
  if (!blank && !(Number.isInteger(h) && Number.isInteger(a) && h >= 0 && a >= 0)) return { error: "Scores must be whole numbers." };
  await saveFixtures([
    { ...fixture, home_score: blank ? null : h, away_score: blank ? null : a, status: blank ? status : "scheduled" },
  ]);
  refreshAll();
  return { ok: true };
}

export async function deleteFixtureAction(competitionId: string, fixtureId: string) {
  if (!(await handEditable(competitionId))) return;
  await deleteFixture(competitionId, fixtureId);
  refreshAll();
}

export async function importFixturesCsv(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const file = formData.get("file");
  let text = String(formData.get("pasted") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) return { error: "That file is too big (max 1 MB)." };
    text = await file.text();
  }
  if (!text.trim()) return { error: "Choose a CSV file or paste the fixtures." };
  const { fixtures, errors } = fixturesFromCsv(text, competitionTz(c));
  if (!fixtures.length) return { error: errors[0] ?? "No fixtures found.", errors };
  const merged = mergeImported(competitionId, await listFixtures(competitionId), fixtures);
  await saveFixtures(merged);
  await addCompetitionTeams(competitionId, fixtures.flatMap((f) => [f.home, f.away]));
  refreshAll();
  return { ok: true, count: merged.length, errors };
}

// ---------- fixtures from a link ----------

function feedFromForm(formData: FormData): FeedSettings | { error: string } {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const url = get("feed_url");
  if (!url) return { error: "Paste the link." };
  if (!/^(https?|webcal):\/\//i.test(url)) return { error: "The link should start with https://" };
  return { type: guessFeedType(url), url, filter: get("feed_filter") || null, team: get("feed_team") || null };
}


// Reads the link without saving anything, so the admin can check it first.
export async function previewFeedAction(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const tz = competitionTz(c);
  const feed = feedFromForm(formData);
  if ("error" in feed) return { error: feed.error };
  try {
    const { type, fixtures, errors } = await readFeed(feed, tz);
    if (!fixtures.length) return { error: errors[0] ?? "No fixtures found at that link." };
    const teams = new Set(fixtures.flatMap((f) => [f.home, f.away]));
    return {
      preview: true,
      kind: FEED_KIND[type],
      count: fixtures.length,
      teams: teams.size,
      sample: fixtures.slice(0, 8).map((f) => {
        const score = f.home_score !== null && f.away_score !== null ? ` ${f.home_score}–${f.away_score}` : "";
        return `${f.round ? `Rd ${f.round} · ` : ""}${formatWhen(f.kickoff, tz)} · ${f.home} v ${f.away}${score}`;
      }),
      errors,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn’t read that link." };
  }
}

export async function connectFeedAction(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const feed = feedFromForm(formData);
  if ("error" in feed) return { error: feed.error };
  await saveFeedSettings(c, feed);
  const res = await syncCompetitionFeed(competitionId, true);
  refreshAll();
  if (!res.count) return { error: res.errors[0] ?? "No fixtures found at that link." };
  return { ok: true, count: res.count };
}

export async function syncNowAction(competitionId: string) {
  if (!(await editableCompetition(competitionId))) return { error: "Not authorised." };
  const res = await syncCompetitionFeed(competitionId, true);
  refreshAll();
  return res.count ? { ok: true, count: res.count } : { error: res.errors[0] ?? "Nothing synced." };
}

export async function disconnectFeedAction(competitionId: string) {
  const c = await handEditable(competitionId);
  if (!c) return;
  await saveFeedSettings(c, null); // fixtures already imported stay
  refreshAll();
}

// ---------- deleting (triple-checked: impact shown, name typed, final confirm) ----------

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function sidelnrTeamsIn(competitionIds: string[]) {
  return (await listTeams()).filter((t) => t.competition_id && competitionIds.includes(t.competition_id));
}

export async function deleteCompetitionAction(competitionId: string, typedName: string) {
  const c = await editableCompetition(competitionId);
  if (!c) return { error: "Not authorised." };
  if (!sameName(typedName, c.name)) return { error: `Type “${c.name}” exactly to confirm.` };
  const teams = await sidelnrTeamsIn([c.id]);
  if (teams.length) return { error: `Still used by ${teams.map((t) => t.name).join(", ")}. Those teams must be moved or deleted first.` };
  await deleteCompetitionRow(c.id);
  refreshAll();
  const rest = (await listCompetitions()).filter((x) => x.league_id === c.league_id);
  redirect(rest.length ? `/account/competitions/${rest[0].id}?deleted=1` : `/account/leagues?deleted=1`, RedirectType.replace);
}

export async function deleteLeagueAction(competitionId: string, typedName: string) {
  const c = await editableCompetition(competitionId);
  if (!c) return { error: "Not authorised." };
  if (!sameName(typedName, c.league.name)) return { error: `Type “${c.league.name}” exactly to confirm.` };
  const comps = (await listCompetitions()).filter((x) => x.league_id === c.league_id).map((x) => x.id);
  const teams = await sidelnrTeamsIn(comps);
  if (teams.length) return { error: `Still used by ${teams.map((t) => t.name).join(", ")}. Those teams must be moved or deleted first.` };
  const isEvent = (await listCompetitions()).filter((x) => x.league_id === c.league_id).every((x) => x.kind === "tournament");
  await deleteLeagueRow(c.league_id);
  refreshAll();
  redirect(isEvent ? "/account/events?deleted=1" : "/account/leagues?deleted=1", RedirectType.replace);
}

// The league's timezone: kick-off times are entered and shown in it.
export async function saveLeagueTimezone(competitionId: string, _: unknown, formData: FormData) {
  const c = await editableCompetition(competitionId);
  if (!c) return { error: "Not authorised." };
  const tz = String(formData.get("timezone") ?? "");
  if (!isTimezone(tz)) return { error: "Pick a timezone from the list." };
  await updateLeague(c.league_id, { timezone: tz });
  refreshAll();
  return { ok: true, timezone: tz };
}

// ---------- events (one-day carnivals) ----------

export async function createEventAction(_: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("league_name");
  if (!name) return { error: "Give your event a name." };
  const date = parseDate(get("season"));
  if (!date) return { error: "Pick the event date." };
  const website = get("website");
  if (website && !/^https?:\/\//i.test(website)) return { error: "Website should start with https://" };

  const leagueId = await uniqueId(name, leagueIdExists);
  const competitionId = await uniqueId(`${leagueId}-${get("competition_name") || "main"}`, competitionIdExists);
  const comp = competitionRow(competitionId, leagueId, get);
  if ("error" in comp) return { error: comp.error };

  await createLeague(
    {
      id: leagueId,
      name,
      short_name: get("short_name") || null,
      website: website || null,
      venue: get("venue") || null,
      source: "manual",
      timezone: isTimezone(get("timezone")) ? get("timezone") : "UTC",
      created_by: managerId,
    },
    managerId,
  );
  // The event's date lives in `season` ("yyyy-mm-dd") so the draw generator can default to it.
  await upsertCompetition({ ...comp, kind: "tournament", season: date, ladder_last_round: null, finals_date: null });
  revalidatePath("/account");
  redirect(`/account/competitions/${competitionId}?new=1`);
}

export async function addEventDivisionAction(leagueId: string, _: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!(await isSuperAdmin()) && !(managerId && (await adminLeagueIds(managerId)).includes(leagueId))) {
    return { error: "You’re not an admin of this event." };
  }
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const id = await uniqueId(`${leagueId}-${get("competition_name") || "division"}`, competitionIdExists);
  const comp = competitionRow(id, leagueId, get);
  if ("error" in comp) return { error: comp.error };
  const sibling = (await listCompetitions()).find((c) => c.league_id === leagueId);
  await upsertCompetition({ ...comp, kind: "tournament", season: sibling?.season ?? null, ladder_last_round: null, finals_date: null });
  revalidatePath("/account");
  redirect(`/account/competitions/${id}?new=1`);
}

// Builds every pool's round-robin and lays it out across the pitches.
export async function generatePoolsAction(competitionId: string, _: unknown, formData: FormData) {
  const c = await handEditable(competitionId);
  if (!c) return { error: "Not authorised." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const pools = parsePools(get("pools"));
  const date = parseDate(get("date"));
  const start = parseTime(get("start"));
  const slot = Number(get("slot_minutes"));
  const pitchInput = get("pitches");
  const pitches = /^\d+$/.test(pitchInput)
    ? Array.from({ length: Number(pitchInput) }, (_, i) => String(i + 1))
    : pitchInput.split(",").map((p) => p.trim()).filter(Boolean);

  if (!pools.length) return { error: "Type the teams, one per line (start each pool with “Pool A”, “Pool B”…)." };
  const tooSmall = pools.find((p) => p.teams.length < 2);
  if (tooSmall) return { error: `${tooSmall.name} needs at least two teams.` };
  if (!date) return { error: "Pick the event date." };
  if (!start) return { error: "Enter the first kick-off, e.g. 9:00 am." };
  if (!Number.isInteger(slot) || slot < 5 || slot > 240) return { error: "Minutes per game should be 5–240 (including the gap between games)." };
  if (!pitches.length || pitches.length > 50) return { error: "Enter how many pitches (e.g. 4) or their names (e.g. 1, 2, Main)." };

  const existing = await listFixtures(competitionId);
  const oldPool = existing.filter((f) => isPoolStage(f.stage));
  if (oldPool.length && get("replace") !== "yes") {
    return { error: `There are already ${oldPool.length} pool games. Tick “Replace the existing pool games” to redo the draw.` };
  }
  for (const f of oldPool) await deleteFixture(competitionId, f.id);

  const draw = schedulePools({ pools, date, start, slotMinutes: slot, pitches, timeZone: competitionTz(c) });
  await saveFixtures(mergeImported(competitionId, oldPool, draw));
  await addCompetitionTeams(competitionId, pools.flatMap((p) => p.teams));
  refreshAll();
  const last = draw.at(-1);
  return { ok: true, count: draw.length, finish: last ? formatWhen(last.kickoff, competitionTz(c)) : null };
}

// Fills in a finals game's teams once the pools are decided.
export async function setFixtureTeamsAction(competitionId: string, fixtureId: string, home: string, away: string) {
  if (!(await handEditable(competitionId))) return { error: "Not authorised." };
  const fixture = (await listFixtures(competitionId)).find((f) => f.id === fixtureId);
  if (!fixture) return { error: "Game not found." };
  home = home.trim();
  away = away.trim();
  if (!home || !away || home === away) return { error: "Pick two different teams." };
  await saveFixtures([{ ...fixture, home, away }]);
  refreshAll();
  return { ok: true };
}

// ---------- fixture wizard (a whole season from a few answers) ----------

function cleanDrawSettings(raw: DrawSettings): DrawSettings {
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const time = (v: unknown, d: string) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : d);
  const num = (v: unknown, min: number, max: number, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
  };
  const text = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return {
    start: date(raw.start),
    end: date(raw.end),
    breaks: (Array.isArray(raw.breaks) ? raw.breaks : []).slice(0, 20).map((b) => ({ from: date(b?.from), to: date(b?.to) })),
    meetings: num(raw.meetings, 1, 6, 1),
    finalsWeeks: num(raw.finalsWeeks, 0, 8, 0),
    days: [...new Set((Array.isArray(raw.days) ? raw.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))],
    windowStart: time(raw.windowStart, "08:30"),
    windowEnd: time(raw.windowEnd, "14:00"),
    venueMode: raw.venueMode === "home" ? "home" : "single",
    venue: text(raw.venue),
    pitches: text(raw.pitches, 200),
    homeGrounds: Object.fromEntries(
      Object.entries(raw.homeGrounds && typeof raw.homeGrounds === "object" ? raw.homeGrounds : {})
        .slice(0, 200)
        .map(([k, v]) => [String(k), text(v)]),
    ),
    groundPitches: num(raw.groundPitches, 1, 20, 1),
    periods: num(raw.periods, 1, 8, 2),
    periodMinutes: num(raw.periodMinutes, 1, 120, 20),
    breakMinutes: num(raw.breakMinutes, 0, 60, 5),
    changeover: num(raw.changeover, 0, 60, 5),
  };
}

// Games with a result (or already kicked off) stay; the rest is redrawn.
async function drawFor(competitionId: string, raw: DrawSettings) {
  const c = await handEditable(competitionId);
  if (!c) return null;
  const settings = cleanDrawSettings(raw);
  const tz = competitionTz(c);
  const [teams, existing] = await Promise.all([listCompetitionTeamNames(competitionId), listFixtures(competitionId)]);
  const now = Date.now();
  const kept = existing.filter((f) => f.home_score !== null || new Date(f.kickoff).getTime() <= now);
  const replaced = existing.filter((f) => !kept.includes(f));
  const lastKept = kept.reduce((m, f) => (f.kickoff > m ? f.kickoff : m), "");
  if (lastKept) {
    const dayAfter = new Date(Date.parse(lastKept) + 86_400_000).toISOString().slice(0, 10);
    if (settings.start < dayAfter) settings.start = dayAfter;
  }
  const draw = buildSeasonDraw(teams, settings, {
    timeZone: tz,
    played: kept.filter((f) => f.status !== "cancelled"),
    roundOffset: kept.reduce((m, f) => Math.max(m, f.round ?? 0), 0),
  });
  return { c, tz, teams, draw, kept, replaced };
}

export async function previewDrawAction(competitionId: string, raw: DrawSettings) {
  const res = await drawFor(competitionId, raw);
  if (!res) {
    return { errors: ["Not authorised."], warnings: [], summary: null, total: 0, keeping: 0, replacing: 0, games: [], balance: [] };
  }
  const { tz, teams, draw, kept, replaced } = res;
  // Balance per team: home games and average kick-off.
  const balance = teams.map((t) => {
    const games = draw.fixtures.filter((f) => f.home === t || f.away === t);
    const minutes = games.map((f) => minutesOfDay(f.kickoff, tz));
    return {
      team: t,
      games: games.length,
      home: games.filter((f) => f.home === t).length,
      avgStart: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
    };
  });
  // Every game, for the list and calendar views.
  const games = draw.fixtures
    .slice()
    .sort((x, y) => x.kickoff.localeCompare(y.kickoff) || (x.pitch ?? "").localeCompare(y.pitch ?? "", undefined, { numeric: true }))
    .map((f) => ({
      round: f.round ?? 0,
      date: isoDateIn(f.kickoff, tz),
      day: formatDay(new Date(f.kickoff), tz),
      time: formatTime(new Date(f.kickoff), tz),
      pitch: f.pitch ? pitchLabel(f.pitch) : "",
      home: f.home,
      away: f.away,
    }));
  return {
    errors: draw.errors,
    warnings: draw.warnings,
    summary: draw.summary,
    total: draw.fixtures.length,
    keeping: kept.length,
    replacing: replaced.length,
    games,
    balance,
  };
}

export async function generateDrawAction(competitionId: string, raw: DrawSettings) {
  const res = await drawFor(competitionId, raw);
  if (!res) return { error: "Not authorised." };
  const { draw, replaced } = res;
  if (draw.errors.length) return { error: draw.errors[0] };
  for (const f of replaced) await deleteFixture(competitionId, f.id);
  // Same match-up in the same round keeps its id (and any attendance/votes).
  await saveFixtures(mergeImported(competitionId, replaced, draw.fixtures));
  refreshAll();
  return { ok: true, count: draw.fixtures.length };
}

// ---------- "Got a league website? Let's see what we can pull." ----------

export async function scanLeagueAction(url: string): Promise<{ scan?: LeagueScan; error?: string }> {
  if (!(await currentManagerId())) return { error: "Sign in first." };
  if (!url.trim()) return { error: "Paste the league’s link." };
  try {
    return { scan: await scanLeague(url) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn’t read that link." };
  }
}

// Creates the league and competition from a scan, connects the link and
// imports its fixtures and teams straight away.
export async function importLeagueAction(input: {
  siteUrl: string;
  feedUrl: string;
  feedType: FeedType;
  leagueName: string;
  shortName: string | null;
  venue: string | null;
  timezone: string;
  ladderStyle: "points" | "wins";
  ladderUrl: string | null;
  competition: string; // the chosen competition's name on the page
  filter: boolean; // the page has several: only import this one
}): Promise<{ competitionId?: string; count?: number; error?: string }> {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const name = input.leagueName.trim().slice(0, 80);
  if (!name) return { error: "Give the league a name." };
  if (!/^https?:\/\//i.test(input.feedUrl)) return { error: "That link doesn’t look right." };
  const compName = (input.competition.trim() || "Main").slice(0, 80);

  const leagueId = await uniqueId(name, leagueIdExists);
  const competitionId = await uniqueId(`${leagueId}-${compName}`, competitionIdExists);
  await createLeague(
    {
      id: leagueId,
      name,
      short_name: input.shortName?.trim().slice(0, 40) || null,
      website: /^https?:\/\//i.test(input.siteUrl) ? input.siteUrl : input.feedUrl, // where squads and the ladder are found
      venue: input.venue?.trim().slice(0, 120) || null,
      source: "manual",
      timezone: isTimezone(input.timezone) ? input.timezone : "UTC",
      created_by: managerId,
    },
    managerId,
  );
  const comp: CompetitionRow = {
    id: competitionId,
    league_id: leagueId,
    name: compName === "Main" ? "Main" : compName,
    season: null,
    kind: "season",
    source_key: null,
    points_win: 3,
    points_draw: 1,
    ladder_last_round: null,
    finals_date: null,
    finals_note: null,
    ladder_style: input.ladderStyle === "wins" ? "wins" : "points",
    ladder_url: input.ladderUrl && /^https?:\/\//i.test(input.ladderUrl) ? input.ladderUrl : null,
  };
  await upsertCompetition(comp);
  await saveFeedSettings(comp, { type: input.feedType, url: input.feedUrl, filter: input.filter ? compName : null, team: null });
  const res = await syncCompetitionFeed(competitionId, true);
  revalidatePath("/account", "layout");
  return { competitionId, count: res.count, error: res.count ? undefined : (res.errors[0] ?? "No games came through yet.") };
}

// ---------- league announcements ----------

// A league announcement to the Sidelnr teams in the league (this
// competition, or all of the league's). "all": posted on every team's Board
// and pushed to everyone; "managers": pushed to managers' phones and emailed
// to each team's managers.
export async function sendLeagueMessage(competitionId: string, _: unknown, formData: FormData) {
  const c = await editableCompetition(competitionId);
  if (!c) return { error: "Not authorised." };
  const body = String(formData.get("body") ?? "").trim();
  const audience = formData.get("audience") === "managers" ? "managers" : "all";
  const wholeLeague = formData.get("scope") === "league";
  if (!c.league.verified_at) return { error: "Only official (verified) leagues can send announcements." };
  if (!body) return { error: "Write something first." };
  if (body.length > 2000) return { error: "Keep it under 2000 characters." };

  const comps = wholeLeague ? (await listCompetitions()).filter((x) => x.league_id === c.league_id).map((x) => x.id) : [c.id];
  // Teams that turned league announcements off don't get them.
  const teams = (await listTeams()).filter((t) => t.competition_id && comps.includes(t.competition_id) && !t.mute_league);
  if (!teams.length) return { error: "No teams on Sidelnr in this league yet, so there’s nobody to tell yet." };
  const league = c.league.short_name ?? c.league.name;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sidelnr.app";
  const base = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https")}://${host}`;

  if (audience === "all") {
    for (const t of teams) await addAnnouncement(t.id, body, undefined, league);
  }
  await addLeagueMessage({ league_id: c.league_id, competition_id: wholeLeague ? null : c.id, audience, body, teams: teams.length });

  after(async () => {
    const payload = (teamId: string) => ({ title: league, body: preview(body), url: `/${teamId}/${audience === "all" ? "board" : "admin"}`, icon: `/${teamId}/icon/192` });
    if (audience === "all") {
      await Promise.allSettled(teams.map((t) => notifyTeam(t.id, "board", payload(t.id), { endpoint: null, author: null })));
      return;
    }
    await Promise.allSettled(teams.map((t) => notifyManagers(t.id, payload(t.id))));
    // Each manager once, even if they run several teams in the league.
    const sent = new Set<string>();
    for (const t of teams) {
      for (const id of await teamManagerIds(t.id)) {
        const m = await getManager(id);
        if (!m || sent.has(m.email)) continue;
        sent.add(m.email);
        const mail = leagueMessageEmail(c.league.name, body, `${base}/${t.id}/admin`);
        await sendEmail(m.email, mail.subject, mail.text, mail.html);
      }
    }
  });
  refreshAll();
  return { ok: true, teams: teams.length, audience, sentAt: new Date().toISOString() };
}

// ---------- verifying a league as official ----------

// Step 1: a code to an email on the league's own domain.
export async function sendLeagueCode(competitionId: string, email: string) {
  const c = await editableCompetition(competitionId);
  const managerId = await currentManagerId();
  if (!c || !managerId) return { error: "Not authorised." };
  if (c.league.verified_at) return { error: "This league is already verified." };
  const feeds = (await listCompetitions()).filter((x) => x.league_id === c.league_id).map((x) => x.feed_url);
  const res = await startEmailClaim(c.league, officialDomains(c.league, feeds), managerId, email);
  if ("error" in res) return res;
  const mail = leagueCodeEmail(c.league.name, res.code);
  if (!(await sendEmail(email.trim().toLowerCase(), mail.subject, mail.text, mail.html))) {
    return { error: "We couldn’t send the email just now. Please try again shortly." };
  }
  return { sent: true };
}

// Step 2: the code back; the league is then official.
export async function confirmLeagueCode(competitionId: string, code: string) {
  const c = await editableCompetition(competitionId);
  const managerId = await currentManagerId();
  if (!c || !managerId) return { error: "Not authorised." };
  const res = await confirmEmailClaim(c.league_id, managerId, code);
  if ("ok" in res) refreshAll();
  return res;
}

// No league domain: ask Sidelnr to check by hand.
export async function requestLeagueReview(competitionId: string, note: string) {
  const c = await editableCompetition(competitionId);
  const managerId = await currentManagerId();
  if (!c || !managerId) return { error: "Not authorised." };
  if (c.league.verified_at) return { error: "This league is already verified." };
  const res = await requestReview(c.league_id, managerId, note);
  if ("ok" in res) refreshAll();
  return res;
}
