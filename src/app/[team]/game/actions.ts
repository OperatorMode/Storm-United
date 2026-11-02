"use server";

import { revalidatePath } from "next/cache";
import { getTeam } from "@/lib/teams";
import { isTeamAdmin } from "@/lib/session";
import { getLeagueData } from "@/lib/league";
import { getAttendance, setAttendance, setManualScore } from "@/lib/store";
import { slotForPlayer } from "@/lib/goalies";
import { gameParts } from "@/lib/role";
import { getLive, saveFieldLayout, saveLive, type LiveGame, type Spot } from "@/lib/game-live";
import { keeperByPart, ourGoals, playedTime, scoresOf, theirGoals, type Counts } from "@/lib/game-live-shared";
import { sportOf } from "@/lib/sports";
import type { Team } from "@/lib/teams";

// My Game (managers only): saving the sideline screen as the coach goes, and
// full time (the score goes into the team's results), and "Save game data"
// (playing time, the keeper and goals into the season tallies).

async function managerTeam(teamId: string) {
  const team = await getTeam(teamId);
  return team && (await isTeamAdmin(team)) ? team : null;
}

const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));

/** Only this team's players, the sport's own kinds of score, sensible numbers, nothing huge. */
function clean(state: LiveGame, team: Team): LiveGame {
  const ok = (id: string) => team.players.some((p) => p.id === id);
  const sport = sportOf(team.sport);
  const kinds = new Set([...sport.kinds.map((k) => k.key), ...(sport.teamScore ? [sport.teamScore.key] : [])]);
  const counts = (c: Counts | undefined, max: number): Counts =>
    Object.fromEntries(Object.entries(c ?? {}).filter(([k, v]) => kinds.has(k) && n(v, max)).map(([k, v]) => [k, n(v, max)]));
  const pos: Record<string, Spot> = {};
  for (const [id, p] of Object.entries(state.pos ?? {})) if (ok(id)) pos[id] = { x: pct(p?.x), y: pct(p?.y) };
  const names = new Set(sport.positions?.map((p) => p.name) ?? []);
  const bibs = Object.fromEntries(Object.entries(state.bibs ?? {}).filter(([id, b]) => ok(id) && names.has(b)));
  const scores = scoresOf(state);
  const marks: Record<string, Counts> = {};
  for (const [id, c] of Object.entries(scores.mine)) if (ok(id) && Object.keys(counts(c, 99)).length) marks[id] = counts(c, 99);
  const log = (Array.isArray(state.log) ? state.log : []).slice(-400).map((e) => ({
    at: n(e?.at, 6 * 3600_000),
    on: [...new Set((Array.isArray(e?.on) ? e.on : []).filter(ok))].slice(0, 40),
    gk: e?.gk && ok(e.gk) ? e.gk : null,
  }));
  const since = state.clock?.runningSince && !Number.isNaN(Date.parse(state.clock.runningSince)) ? state.clock.runningSince : null;
  return {
    sport: sport.id,
    onField: [...new Set((state.onField ?? []).filter(ok))].slice(0, 40),
    pos,
    bibs,
    clock: { elapsedMs: n(state.clock?.elapsedMs, 6 * 3600_000), runningSince: since },
    marks,
    teamMarks: counts(scores.team, 99),
    themMarks: counts(scores.them, 999),
    scorers: {},
    ownGoals: 0,
    them: 0,
    doneSwaps: [...new Set((state.doneSwaps ?? []).map((m) => n(m, 600)))].slice(0, 60),
    ended: !!state.ended,
    startedAt: state.startedAt && !Number.isNaN(Date.parse(state.startedAt)) ? state.startedAt : null,
    log,
    saved: null, // only "Save game data" sets it (on the server)
  };
}

export async function saveGame(teamId: string, gameId: string, state: LiveGame) {
  const team = await managerTeam(teamId);
  if (!team) return { error: "Managers only." };
  const tidy = clean(state, team);
  tidy.saved = (await getLive(team.id, gameId.slice(0, 200)))?.saved ?? null;
  await saveLive(team.id, gameId.slice(0, 200), tidy);
  // Where they played: remembered for next game.
  if (Object.keys(tidy.pos).length) await saveFieldLayout(team.id, tidy.pos);
  return { ok: true };
}

/** Full time: the clock stops, and the score goes into the team's results (Backup scores). */
export async function endGame(teamId: string, gameId: string, state: LiveGame) {
  const team = await managerTeam(teamId);
  if (!team) return { error: "Managers only." };
  const tidy = { ...clean(state, team), ended: true, saved: (await getLive(team.id, gameId))?.saved ?? null };
  const clock = tidy.clock;
  if (clock.runningSince) tidy.clock = { elapsedMs: clock.elapsedMs + (Date.now() - Date.parse(clock.runningSince)), runningSince: null };
  await saveLive(team.id, gameId, tidy);
  const game = (await getLeagueData(team)).ourGames.find((g) => g.id === gameId);
  if (game) {
    const [us, them] = [ourGoals(tidy), theirGoals(tidy)];
    const home = game.home === team.league_name;
    await setManualScore(team.id, gameId, home ? { home: us, away: them } : { home: them, away: us });
  }
  revalidatePath(`/${team.id}`, "layout");
  revalidatePath("/");
  return { ok: true };
}

/**
 * After full time: the game's playing time, keeper and goals into the season
 * tallies (Manager's Corner). Playing time and goals are read from the saved
 * game; the keeper of each part of the game (halves...) becomes that part's
 * goalie (or the team's special role). Saving again replaces it.
 */
export async function saveGameData(teamId: string, gameId: string) {
  const team = await managerTeam(teamId);
  if (!team) return { error: "Managers only." };
  const live = await getLive(team.id, gameId);
  if (!live?.ended) return { error: "Full time first." };
  const attendance = (await getAttendance(team.id)).filter((a) => a.game_id === gameId);
  const out = new Set(attendance.filter((a) => a.status === "no").map((a) => a.player_id));
  const { played, gk } = playedTime(live);
  const total = live.clock.elapsedMs;
  const min = (ms: number) => Math.round(ms / 60_000);
  // Everyone who was there (not marked out, or who played) rested whatever they didn't play.
  const there = team.players.map((p) => p.id).filter((id) => !out.has(id) || played[id]);
  const saved = {
    played: Object.fromEntries(there.map((id) => [id, min(played[id] ?? 0)])),
    rested: Object.fromEntries(there.map((id) => [id, Math.max(0, min(total - (played[id] ?? 0)))])),
    gk: Object.fromEntries(Object.entries(gk).map(([id, ms]) => [id, min(ms)]).filter(([, m]) => (m as number) > 0)),
    at: new Date().toISOString(),
  };
  await saveLive(team.id, gameId, { ...live, saved });

  // The keeper in each part of the game counts in the goalie tally.
  if (team.goalie_enabled) {
    const { count } = gameParts(team);
    const assigned = keeperByPart(live, count);
    for (const p of team.players) {
      const existing = attendance.find((r) => r.player_id === p.id);
      const goalie = slotForPlayer(p.id, assigned, count);
      if ((existing?.goalie ?? null) === goalie) continue;
      await setAttendance(team.id, { game_id: gameId, player_id: p.id, status: goalie ? "yes" : (existing?.status ?? "yes"), goalie });
    }
  }
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true, saved };
}
