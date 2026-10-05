"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentManagerId, isSuperAdmin } from "@/lib/session";
import { getCompetition } from "@/lib/league";
import { slugify } from "@/lib/teams";
import {
  addCompetitionTeams,
  adminLeagueIds,
  competitionIdExists,
  createLeague,
  deleteFixture,
  fixturesFromCsv,
  leagueIdExists,
  listFixtures,
  mergeImported,
  newFixtureId,
  parseDate,
  parseTime,
  removeCompetitionTeam,
  saveFixtures,
  upsertCompetition,
  zonedTime,
} from "@/lib/fixtures";
import type { CompetitionRow } from "@/lib/store";

const TZ = "Australia/Perth"; // display is Perth-only for now; per-league timezones come later

// Fixture/result changes show up on every team page in the competition.
const refreshAll = () => revalidatePath("/", "layout");

async function uniqueId(base: string, exists: (id: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base) || "league";
  let id = root;
  for (let n = 2; await exists(id); n++) id = `${root}-${n}`;
  return id;
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
      timezone: TZ,
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
  const c = await editableCompetition(competitionId);
  if (!c) return { error: "Not authorised." };
  const comp = competitionRow(c.id, c.league_id, (k) => String(formData.get(k) ?? "").trim());
  if ("error" in comp) return { error: comp.error };
  await upsertCompetition({ ...comp, kind: c.kind, source_key: c.source_key });
  refreshAll();
  return { ok: true };
}

export async function addTeamsAction(competitionId: string, _: unknown, formData: FormData) {
  if (!(await editableCompetition(competitionId))) return { error: "Not authorised." };
  const names = String(formData.get("teams") ?? "").split("\n");
  await addCompetitionTeams(competitionId, names);
  refreshAll();
  return { ok: true };
}

export async function removeTeamAction(competitionId: string, name: string) {
  if (!(await editableCompetition(competitionId))) return;
  const used = (await listFixtures(competitionId)).some((f) => f.home === name || f.away === name);
  if (used) return { error: `${name} still has fixtures — delete those first.` };
  await removeCompetitionTeam(competitionId, name);
  refreshAll();
}

export async function addFixtureAction(competitionId: string, _: unknown, formData: FormData) {
  if (!(await editableCompetition(competitionId))) return { error: "Not authorised." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const date = parseDate(get("date"));
  const time = parseTime(get("time"));
  const home = get("home");
  const away = get("away");
  if (!date) return { error: "Pick a date." };
  if (!time) return { error: "Enter a kick-off time, e.g. 5:45 pm." };
  if (!home || !away || home === away) return { error: "Pick two different teams." };
  const round = get("round");
  await saveFixtures([
    {
      id: newFixtureId(),
      competition_id: competitionId,
      round: round ? Number(round) : null,
      stage: null,
      kickoff: zonedTime(date, time, TZ).toISOString(),
      pitch: get("pitch") || null,
      home,
      away,
      home_score: null,
      away_score: null,
      status: "scheduled",
    },
  ]);
  await addCompetitionTeams(competitionId, [home, away]);
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
  if (!(await editableCompetition(competitionId))) return { error: "Not authorised." };
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
  if (!(await editableCompetition(competitionId))) return;
  await deleteFixture(competitionId, fixtureId);
  refreshAll();
}

export async function importFixturesCsv(competitionId: string, _: unknown, formData: FormData) {
  if (!(await editableCompetition(competitionId))) return { error: "Not authorised." };
  const file = formData.get("file");
  let text = String(formData.get("pasted") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) return { error: "That file is too big (max 1 MB)." };
    text = await file.text();
  }
  if (!text.trim()) return { error: "Choose a CSV file or paste the fixtures." };
  const { fixtures, errors } = fixturesFromCsv(text, TZ);
  if (!fixtures.length) return { error: errors[0] ?? "No fixtures found.", errors };
  const merged = mergeImported(competitionId, await listFixtures(competitionId), fixtures);
  await saveFixtures(merged);
  await addCompetitionTeams(competitionId, fixtures.flatMap((f) => [f.home, f.away]));
  refreshAll();
  return { ok: true, count: merged.length, errors };
}
