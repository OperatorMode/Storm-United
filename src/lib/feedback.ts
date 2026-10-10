import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";

// "Send feedback": ideas, bugs and anything else, for the owner page (/super).

export type FeedbackKind = "idea" | "bug" | "other";
export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  page: string | null;
  device: string | null;
  done: boolean;
  created_at: string;
};

export const FEEDBACK_KINDS: Record<FeedbackKind, string> = { idea: "Idea", bug: "Bug", other: "Something else" };

export async function addFeedback(f: Omit<Feedback, "id" | "done" | "created_at">): Promise<void> {
  const row: Feedback = { ...f, id: randomUUID(), done: false, created_at: new Date().toISOString() };
  const s = db();
  if (!s) {
    const d = await readLocal();
    (d.feedback ??= []).push(row);
    return writeLocal(d);
  }
  check(await s.from("feedback").insert(row));
}

/** Newest first: everything still open, plus the last few marked done. */
export async function listFeedback(): Promise<{ open: Feedback[]; done: Feedback[] }> {
  try {
    const s = db();
    const all: Feedback[] = s
      ? (check(await s.from("feedback").select("*").order("created_at", { ascending: false }).limit(200)) as Feedback[])
      : [...((await readLocal()).feedback ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { open: all.filter((f) => !f.done), done: all.filter((f) => f.done).slice(0, 10) };
  } catch {
    return { open: [], done: [] }; // e.g. before migration 027
  }
}

export async function setFeedbackDone(id: string, done: boolean): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.feedback = (d.feedback ?? []).map((f) => (f.id === id ? { ...f, done } : f));
    return writeLocal(d);
  }
  check(await s.from("feedback").update({ done }).eq("id", id));
}
