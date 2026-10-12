"use server";

import { revalidatePath } from "next/cache";
import { getTeam } from "@/lib/teams";
import { isTeamAdmin } from "@/lib/session";
import { getLeagueData } from "@/lib/league";
import { setManualScore } from "@/lib/store";
import { ourGoals, saveFieldLayout, saveLive, type LiveGame, type Spot } from "@/lib/game-live";

// My Game (managers only): saving the sideline screen as the coach goes, and
// full time (the score goes into the team's results).

async function managerTeam(teamId: string) {
  const team = await getTeam(teamId);
  return team && (await isTeamAdmin(team)) ? team : null;
}

const n = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));

/** Only this team's players, sensible numbers, nothing huge. */
function clean(state: LiveGame, playerIds: string[]): LiveGame {
  const ok = (id: string) => playerIds.includes(id);
  const pos: Record<string, Spot> = {};
  for (const [id, p] of Object.entries(state.pos ?? {})) if (ok(id)) pos[id] = { x: pct(p?.x), y: pct(p?.y) };
  const scorers: Record<string, number> = {};
  for (const [id, g] of Object.entries(state.scorers ?? {})) if (ok(id) && n(g, 99)) scorers[id] = n(g, 99);
  const since = state.clock?.runningSince && !Number.isNaN(Date.parse(state.clock.runningSince)) ? state.clock.runningSince : null;
  return {
    onField: [...new Set((state.onField ?? []).filter(ok))].slice(0, 30),
    pos,
    clock: { elapsedMs: n(state.clock?.elapsedMs, 6 * 3600_000), runningSince: since },
    scorers,
    ownGoals: n(state.ownGoals, 99),
    them: n(state.them, 99),
    doneSwaps: [...new Set((state.doneSwaps ?? []).map((m) => n(m, 600)))].slice(0, 60),
    ended: !!state.ended,
    startedAt: state.startedAt && !Number.isNaN(Date.parse(state.startedAt)) ? state.startedAt : null,
  };
}

export async function saveGame(teamId: string, gameId: string, state: LiveGame) {
  const team = await managerTeam(teamId);
  if (!team) return { error: "Managers only." };
  const ids = team.players.map((p) => p.id);
  const tidy = clean(state, ids);
  await saveLive(team.id, gameId.slice(0, 200), tidy);
  // Where they played: remembered for next game.
  if (Object.keys(tidy.pos).length) await saveFieldLayout(team.id, tidy.pos);
  return { ok: true };
}

/** Full time: the clock stops, and the score goes into the team's results (Backup scores). */
export async function endGame(teamId: string, gameId: string, state: LiveGame) {
  const team = await managerTeam(teamId);
  if (!team) return { error: "Managers only." };
  const tidy = { ...clean(state, team.players.map((p) => p.id)), ended: true };
  const clock = tidy.clock;
  if (clock.runningSince) tidy.clock = { elapsedMs: clock.elapsedMs + (Date.now() - Date.parse(clock.runningSince)), runningSince: null };
  await saveLive(team.id, gameId, tidy);
  const game = (await getLeagueData(team)).ourGames.find((g) => g.id === gameId);
  if (game) {
    const us = ourGoals(tidy);
    const home = game.home === team.league_name;
    await setManualScore(team.id, gameId, home ? { home: us, away: tidy.them } : { home: tidy.them, away: us });
  }
  revalidatePath(`/${team.id}`, "layout");
  revalidatePath("/");
  return { ok: true };
}
