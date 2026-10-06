"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getAttendance, getTeamRow, savePlayers, setAttendance, setManualScore, upsertTeam } from "@/lib/store";
import { competitionTeams, getCompetition, getLeagueData, teamTz } from "@/lib/league";
import { addTraining, deleteTraining, listTraining, newTrainingId, setTrainingCancelled, type TrainingRow } from "@/lib/training";
import { parseDate, parseTime, zonedTime } from "@/lib/fixtures";
import { formatDay, formatTime } from "@/lib/time";
import { getPushSubs } from "@/lib/messages";
import { sendPush } from "@/lib/push";
import { releaseDuty, saveDuties, takeDuty } from "@/lib/duties";
import { saveRotation } from "@/lib/rotation";
import type { RotationPlan } from "@/lib/rotation-plan";
import { getTeam, isActivePlayer, joinCodeFields, mergePlayers, type Team } from "@/lib/teams";
import { goalieSlot } from "@/lib/goalies";
import { mergePlayer } from "@/lib/merge";
import { MANAGER_COOKIE, SUPER_COOKIE, adminCookie, isTeamAdmin } from "@/lib/session";

async function adminTeam(teamId: string): Promise<Team | null> {
  const team = await getTeam(teamId);
  return team && (await isTeamAdmin(team)) ? team : null;
}

function refresh(teamId: string) {
  revalidatePath(`/${teamId}`);
  revalidatePath(`/${teamId}/admin`);
}

export async function saveManualScore(teamId: string, gameId: string, home: string, away: string) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  if (home === "" && away === "") {
    await setManualScore(team.id, gameId, null);
  } else {
    const h = Number(home);
    const a = Number(away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      return { error: "Scores must be whole numbers." };
    }
    await setManualScore(team.id, gameId, { home: h, away: a });
  }
  refresh(team.id);
  return { ok: true };
}

// The coach's pick is final: whoever is chosen for each half gets that slot
// (and is marked as playing); every other goalie tick for the game is cleared.
export async function setGameGoalies(teamId: string, gameId: string, first: string | null, second: string | null) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  if ((first && !isActivePlayer(team, first)) || (second && !isActivePlayer(team, second))) {
    return { error: "Unknown player." };
  }
  const { ourGames } = await getLeagueData(team);
  if (!ourGames.some((g) => g.id === gameId)) return { error: "Game not found." };

  const rows = (await getAttendance(team.id)).filter((a) => a.game_id === gameId);
  for (const p of team.players) {
    const existing = rows.find((r) => r.player_id === p.id);
    const goalie = goalieSlot(p.id, first, second);
    if ((existing?.goalie ?? null) === goalie && (!goalie || existing?.status === "yes")) continue;
    await setAttendance(team.id, {
      game_id: gameId,
      player_id: p.id,
      status: goalie ? "yes" : (existing?.status ?? "yes"),
      goalie,
    });
  }
  refresh(team.id);
  return { ok: true };
}

// Settings a team's own admin can change: squad, join code, meeting time, goalie sign-up.
export async function saveTeamSettings(teamId: string, _: unknown, formData: FormData) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };

  const names = String(formData.get("players") ?? "").split("\n");
  const players = mergePlayers(team.allPlayers, names);
  if (!players.some((p) => p.active)) return { error: "Add at least one player." };

  const meet = Number(formData.get("meet_minutes"));
  if (!Number.isInteger(meet) || meet < 0 || meet > 120) return { error: "Meeting time must be 0–120 minutes." };

  const join = await joinCodeFields(
    team.id,
    { code: String(formData.get("join_code") ?? ""), clear: formData.get("clear_join") === "on" },
    team,
  );
  if ("error" in join) return { error: join.error };

  const { players: _p, allPlayers: _a, ...row } = team; // eslint-disable-line @typescript-eslint/no-unused-vars
  await upsertTeam({
    ...row,
    meet_minutes: meet,
    goalie_enabled: formData.get("goalie_enabled") === "on",
    ...join,
  });
  await savePlayers(team.id, players);
  refresh(team.id);
  return { ok: true };
}

// Locks Manager’s Corner on this device: team PIN, super admin PIN and email sign-in.
export async function adminLogout(teamId: string) {
  const store = await cookies();
  store.delete(adminCookie(teamId));
  store.delete(SUPER_COOKIE);
  store.delete(MANAGER_COOKIE);
  revalidatePath(`/${teamId}/admin`);
}

// Merges a removed player (e.g. an old spelling of a name) into a current one,
// moving their attendance, votes, acknowledgements and chat across.
export async function mergeRemovedPlayer(teamId: string, fromId: string, toId: string) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const from = team.allPlayers.find((p) => p.id === fromId && !p.active);
  if (!from) return { error: "Only removed players can be merged." };
  if (!isActivePlayer(team, toId)) return { error: "Pick a current player to merge into." };
  await mergePlayer(team.id, fromId, toId);
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// ---------- new season ----------

// Team names in a competition's draw (to pick "who are we" in the new season).
export async function drawTeamNames(teamId: string, competitionId: string): Promise<string[]> {
  if (!(await adminTeam(teamId))) return [];
  return competitionTeams(competitionId);
}

// Moves the team into its next season: new competition (and name in that
// draw), who's playing again, and new players. Attendance and votes from
// earlier seasons stay as history.
export async function rolloverSeason(
  teamId: string,
  input: { competitionId: string; leagueName: string; keep: string[]; newPlayers: string[] },
) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const competition = await getCompetition(input.competitionId);
  if (!competition) return { error: "Pick the competition for the new season." };
  const leagueName = input.leagueName.trim();
  if (!leagueName) return { error: "Enter your team’s name as it appears in that competition’s draw." };
  const kept = team.players.filter((p) => input.keep.includes(p.id)).map((p) => p.name);
  const added = input.newPlayers.map((n) => n.trim()).filter(Boolean);
  if (kept.length + added.length === 0) return { error: "The squad can’t be empty." };

  const row = await getTeamRow(team.id);
  if (!row) return { error: "Team not found." };
  await upsertTeam({ ...row, competition_id: competition.id, league_name: leagueName });
  await savePlayers(team.id, mergePlayers(team.allPlayers, [...kept, ...added]));
  revalidatePath(`/${team.id}`, "layout");
  revalidatePath("/me");
  return { ok: true };
}

// ---------- training ----------

export async function createTraining(teamId: string, _: unknown, formData: FormData) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const date = parseDate(get("date"));
  const time = parseTime(get("time"));
  const minutes = Number(get("minutes") || 60);
  if (!date) return { error: "Pick the date of the (first) session." };
  if (!time) return { error: "Enter the start time, e.g. 5:00 pm." };
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 300) return { error: "Length should be 15 to 300 minutes." };
  const weekly = get("repeat") === "weekly";
  const until = weekly ? parseDate(get("until")) : date;
  if (!until || until < date) return { error: "Pick until when training repeats." };

  const tz = await teamTz(team);
  const seriesId = weekly ? newTrainingId() : null;
  const rows: TrainingRow[] = [];
  for (let d = Date.parse(`${date}T12:00:00Z`); d <= Date.parse(`${until}T12:00:00Z`) && rows.length < 60; d += 7 * 86_400_000) {
    rows.push({
      id: newTrainingId(),
      team_id: team.id,
      starts_at: zonedTime(new Date(d).toISOString().slice(0, 10), time, tz).toISOString(),
      minutes,
      location: get("location") || null,
      note: get("note") || null,
      cancelled: false,
      series_id: seriesId,
    });
  }
  await addTraining(rows);
  refresh(team.id);
  return { ok: true, count: rows.length };
}

// Cancelling (e.g. wet weather) tells everyone with game alerts switched on.
export async function setTrainingOff(teamId: string, id: string, cancelled: boolean) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const session = (await listTraining(team.id)).find((t) => t.id === id);
  if (!session) return { error: "Session not found." };
  await setTrainingCancelled(team.id, id, cancelled);
  refresh(team.id);
  const tz = await teamTz(team);
  const when = `${formatDay(new Date(session.starts_at), tz)}, ${formatTime(new Date(session.starts_at), tz)}`;
  after(async () => {
    const subs = (await getPushSubs(team.id)).filter((s) => s.notify_games !== false);
    await Promise.allSettled(
      subs.map((s) =>
        sendPush(s, {
          title: `${team.name}: training ${cancelled ? "cancelled" : "is back on"}`,
          body: cancelled ? `${when} training is off.` : `${when} training is on again.`,
          url: `/${team.id}`,
          icon: `/${team.id}/icon/192`,
          tag: `${team.id}-training-${id}`,
        }),
      ),
    );
  });
  return { ok: true };
}

export async function removeTraining(teamId: string, id: string, laterInSeries: boolean) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  await deleteTraining(team.id, id, laterInSeries);
  refresh(team.id);
  return { ok: true };
}

// ---------- duty roster (coach) ----------

export async function saveDutyList(teamId: string, _: unknown, formData: FormData) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  const names = [...new Set(String(formData.get("duties") ?? "").split(/\r?\n/).map((n) => n.trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
  await saveDuties(team.id, names);
  refresh(team.id);
  return { ok: true, count: names.length };
}

// The coach puts a family on a duty (playerId) or clears it ("").
export async function assignDuty(teamId: string, gameId: string, duty: string, playerId: string) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  await releaseDuty(team.id, gameId, duty);
  if (playerId && isActivePlayer(team, playerId)) await takeDuty(team.id, gameId, duty, playerId);
  refresh(team.id);
  return { ok: true };
}

// ---------- fair playing time ----------

export async function saveGameRotation(teamId: string, gameId: string, plan: RotationPlan | null) {
  const team = await adminTeam(teamId);
  if (!team) return { error: "Not authorised." };
  if (plan) {
    const ok =
      Number.isInteger(plan.periods) && plan.periods >= 1 && plan.periods <= 8 &&
      Number.isInteger(plan.onField) && plan.onField >= 1 && plan.onField <= 30 &&
      Object.entries(plan.spots).every(([id, list]) => isActivePlayer(team, id) && Array.isArray(list) && list.length === plan.periods && list.every((s) => ["on", "rest", "gk"].includes(s)));
    if (!ok) return { error: "That rotation doesn’t look right." };
  }
  await saveRotation(team.id, gameId, plan);
  refresh(team.id);
  return { ok: true };
}
