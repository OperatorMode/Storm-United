import { cache } from "react";
import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";

// Training sessions. Weekly training is stored as one row per session sharing
// a series_id, so one week can be cancelled on its own. Parents' answers live
// in the attendance table, keyed by the session id.

export type TrainingRow = {
  id: string;
  team_id: string;
  starts_at: string; // ISO
  minutes: number;
  location: string | null;
  note: string | null;
  cancelled: boolean;
  series_id: string | null;
};

const COLS = "id, team_id, starts_at, minutes, location, note, cancelled, series_id";

// Reads never break a page: if the table isn't there yet (migration 010 not
// run), training is simply empty.
export const listTraining = cache(async (teamId: string): Promise<TrainingRow[]> => {
  try {
    const s = db();
    const rows = s
      ? (check(await s.from("training_sessions").select(COLS).eq("team_id", teamId)) as TrainingRow[])
      : ((await readLocal()).training ?? []).filter((t) => t.team_id === teamId);
    return rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  } catch (err) {
    console.error("training unavailable", err);
    return [];
  }
});

export async function addTraining(rows: TrainingRow[]): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    (d.training ??= []).push(...rows);
    return writeLocal(d);
  }
  check(await s.from("training_sessions").insert(rows));
}

export async function setTrainingCancelled(teamId: string, id: string, cancelled: boolean): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.training = (d.training ?? []).map((t) => (t.team_id === teamId && t.id === id ? { ...t, cancelled } : t));
    return writeLocal(d);
  }
  check(await s.from("training_sessions").update({ cancelled }).eq("team_id", teamId).eq("id", id));
}

/** Deletes one session, or it and every later session in its weekly series. */
export async function deleteTraining(teamId: string, id: string, laterInSeries: boolean): Promise<void> {
  const all = await listTraining(teamId);
  const row = all.find((t) => t.id === id);
  if (!row) return;
  const ids =
    laterInSeries && row.series_id ? all.filter((t) => t.series_id === row.series_id && t.starts_at >= row.starts_at).map((t) => t.id) : [id];
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.training = (d.training ?? []).filter((t) => !(t.team_id === teamId && ids.includes(t.id)));
    return writeLocal(d);
  }
  check(await s.from("training_sessions").delete().eq("team_id", teamId).in("id", ids));
}

/** New season without last season's training: every session from now on goes. */
export async function deleteFutureTraining(teamId: string, from: Date): Promise<void> {
  const ids = (await listTraining(teamId)).filter((t) => new Date(t.starts_at) >= from).map((t) => t.id);
  if (!ids.length) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.training = (d.training ?? []).filter((t) => !(t.team_id === teamId && ids.includes(t.id)));
    return writeLocal(d);
  }
  check(await s.from("training_sessions").delete().eq("team_id", teamId).in("id", ids));
}

export const newTrainingId = () => `tr-${randomUUID()}`;
