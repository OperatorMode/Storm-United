import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal } from "./store";
import { firstName, type Team } from "./teams";

// Private messages between families in a team: one-to-one or small groups.
// Parents only: players' own phones ("I am…") can't use them (see session's
// isPlayerSelf). A member is a player's id (the phone that picked that child
// is "Sam's parent") or "coach" (any phone in Manager's Corner).
// Same pattern as store.ts: Supabase in production, a local JSON file in dev.

export type Conversation = {
  id: string;
  team_id: string;
  name: string | null; // groups
  is_group: boolean;
  created_by: string;
  created_at: string;
  last_message_at: string;
};
export type ConversationMember = {
  conversation_id: string;
  member: string;
  joined_at: string;
  left_at: string | null;
  last_read_at: string | null;
};
export type DirectMessage = {
  id: string;
  conversation_id: string;
  author: string;
  body: string;
  kind: "text" | "system";
  removed: boolean;
  created_at: string;
};
export type DmReport = { id: string; team_id: string; message_id: string; reporter: string; handled: boolean; created_at: string };

export const COACH = "coach";
export const MAX_GROUP = 12;

/** "Coach", or "Sam's parent". */
export function memberLabel(team: Team, member: string): string {
  if (member === COACH) return "Coach";
  const p = team.allPlayers.find((x) => x.id === member);
  return p ? `${firstName(p.name)}’s parent` : "A parent";
}

const now = () => new Date().toISOString();

// ---------- reading ----------

export async function membersOf(conversationIds: string[]): Promise<ConversationMember[]> {
  if (!conversationIds.length) return [];
  const s = db();
  if (!s) return ((await readLocal()).conversation_members ?? []).filter((m) => conversationIds.includes(m.conversation_id));
  return check(await s.from("conversation_members").select("*").in("conversation_id", conversationIds)) as ConversationMember[];
}

/** The conversations these identities are (still) in, newest first. */
export async function conversationsFor(teamId: string, ids: string[]): Promise<Conversation[]> {
  if (!ids.length) return [];
  const s = db();
  let mine: ConversationMember[];
  if (!s) mine = ((await readLocal()).conversation_members ?? []).filter((m) => ids.includes(m.member) && !m.left_at);
  else mine = check(await s.from("conversation_members").select("*").in("member", ids).is("left_at", null)) as ConversationMember[];
  const convIds = [...new Set(mine.map((m) => m.conversation_id))];
  if (!convIds.length) return [];
  const rows: Conversation[] = s
    ? (check(await s.from("conversations").select("*").eq("team_id", teamId).in("id", convIds)) as Conversation[])
    : ((await readLocal()).conversations ?? []).filter((c) => c.team_id === teamId && convIds.includes(c.id));
  return rows.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export async function getConversation(teamId: string, id: string): Promise<Conversation | null> {
  const s = db();
  if (!s) return ((await readLocal()).conversations ?? []).find((c) => c.team_id === teamId && c.id === id) ?? null;
  return check(await s.from("conversations").select("*").eq("team_id", teamId).eq("id", id).maybeSingle()) as Conversation | null;
}

/** A conversation's messages, oldest first (optionally only newer than `after`). */
export async function messagesIn(conversationId: string, after?: string): Promise<DirectMessage[]> {
  const s = db();
  if (!s) {
    return ((await readLocal()).direct_messages ?? [])
      .filter((m) => m.conversation_id === conversationId && (!after || m.created_at > after))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-300);
  }
  let q = s.from("direct_messages").select("*").eq("conversation_id", conversationId);
  if (after) q = q.gt("created_at", after);
  const rows = check(await q.order("created_at", { ascending: false }).limit(300)) as DirectMessage[];
  return rows.reverse();
}

/** The latest message of each conversation (for the list). */
export async function lastMessages(conversationIds: string[]): Promise<Record<string, DirectMessage>> {
  const out: Record<string, DirectMessage> = {};
  for (const id of conversationIds) {
    const s = db();
    const row: DirectMessage | null | undefined = s
      ? ((check(await s.from("direct_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1)) as DirectMessage[])[0] ?? null)
      : ((await readLocal()).direct_messages ?? []).filter((m) => m.conversation_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (row) out[id] = row;
  }
  return out;
}

/** Messages others posted after these members last read (per conversation). */
export async function unreadCounts(conversationIds: string[], ids: string[], hiddenAuthors: string[] = []): Promise<Record<string, number>> {
  const members = (await membersOf(conversationIds)).filter((m) => ids.includes(m.member));
  const out: Record<string, number> = {};
  for (const id of conversationIds) {
    const read = members.filter((m) => m.conversation_id === id).map((m) => m.last_read_at ?? m.joined_at).sort().at(-1) ?? "";
    const msgs = await messagesIn(id, read);
    out[id] = msgs.filter((m) => m.kind === "text" && !ids.includes(m.author) && !hiddenAuthors.includes(m.author)).length;
  }
  return out;
}

// ---------- writing ----------

async function insert<T extends object>(table: "conversations" | "conversation_members" | "direct_messages" | "dm_blocks" | "dm_reports", rows: T[]) {
  if (!rows.length) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    const list = ((d as Record<string, unknown>)[table] ??= []) as T[];
    list.push(...rows);
    return writeLocal(d);
  }
  check(await s.from(table).insert(rows));
}

/** A new conversation (or the existing one-to-one between the same two). */
export async function startConversation(teamId: string, creator: string, others: string[], name: string | null): Promise<string> {
  const people = [...new Set(others.filter((o) => o !== creator))].slice(0, MAX_GROUP - 1);
  const isGroup = people.length > 1 || !!name;
  if (!isGroup) {
    const existing = (await conversationsFor(teamId, [creator])).filter((c) => !c.is_group);
    const members = await membersOf(existing.map((c) => c.id));
    const same = existing.find((c) => {
      const active = members.filter((m) => m.conversation_id === c.id && !m.left_at).map((m) => m.member);
      return active.length === 2 && active.includes(people[0]);
    });
    if (same) return same.id;
  }
  const id = randomUUID();
  const at = now();
  await insert("conversations", [{ id, team_id: teamId, name: isGroup ? name?.trim().slice(0, 60) || null : null, is_group: isGroup, created_by: creator, created_at: at, last_message_at: at }]);
  await insert(
    "conversation_members",
    [creator, ...people].map((member) => ({ conversation_id: id, member, joined_at: at, left_at: null, last_read_at: member === creator ? at : null })),
  );
  return id;
}

export async function addMessage(conversationId: string, author: string, body: string, kind: "text" | "system" = "text"): Promise<DirectMessage> {
  const row: DirectMessage = { id: randomUUID(), conversation_id: conversationId, author, body, kind, removed: false, created_at: now() };
  await insert("direct_messages", [row]);
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.conversations = (d.conversations ?? []).map((c) => (c.id === conversationId ? { ...c, last_message_at: row.created_at } : c));
    await writeLocal(d);
  } else check(await s.from("conversations").update({ last_message_at: row.created_at }).eq("id", conversationId));
  return row;
}

async function updateMember(conversationId: string, member: string, patch: Partial<ConversationMember>) {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.conversation_members = (d.conversation_members ?? []).map((m) => (m.conversation_id === conversationId && m.member === member ? { ...m, ...patch } : m));
    return writeLocal(d);
  }
  check(await s.from("conversation_members").update(patch).eq("conversation_id", conversationId).eq("member", member));
}

export const markRead = (conversationId: string, member: string) => updateMember(conversationId, member, { last_read_at: now() });
export const leaveConversation = (conversationId: string, member: string) => updateMember(conversationId, member, { left_at: now() });

// ---------- blocking and reporting ----------

export async function blocksBy(teamId: string, blockers: string[]): Promise<string[]> {
  const s = db();
  const rows: { blocker: string; blocked: string }[] = s
    ? (check(await s.from("dm_blocks").select("blocker, blocked").eq("team_id", teamId)) as { blocker: string; blocked: string }[])
    : ((await readLocal()).dm_blocks ?? []).filter((b) => b.team_id === teamId);
  return rows.filter((b) => blockers.includes(b.blocker)).map((b) => b.blocked);
}

/** Whether `a` blocked `b` or `b` blocked `a`. */
export async function blockedBetween(teamId: string, a: string[], b: string[]): Promise<boolean> {
  const s = db();
  const rows: { blocker: string; blocked: string }[] = s
    ? (check(await s.from("dm_blocks").select("blocker, blocked").eq("team_id", teamId)) as { blocker: string; blocked: string }[])
    : ((await readLocal()).dm_blocks ?? []).filter((x) => x.team_id === teamId);
  return rows.some((r) => (a.includes(r.blocker) && b.includes(r.blocked)) || (b.includes(r.blocker) && a.includes(r.blocked)));
}

export async function setBlock(teamId: string, blocker: string, blocked: string, on: boolean): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.dm_blocks = (d.dm_blocks ?? []).filter((b) => !(b.team_id === teamId && b.blocker === blocker && b.blocked === blocked));
    if (on) d.dm_blocks.push({ team_id: teamId, blocker, blocked, created_at: now() });
    return writeLocal(d);
  }
  if (on) check(await s.from("dm_blocks").upsert({ team_id: teamId, blocker, blocked }, { onConflict: "team_id,blocker,blocked" }));
  else check(await s.from("dm_blocks").delete().eq("team_id", teamId).eq("blocker", blocker).eq("blocked", blocked));
}

export async function reportMessage(teamId: string, messageId: string, reporter: string): Promise<void> {
  await insert("dm_reports", [{ id: randomUUID(), team_id: teamId, message_id: messageId, reporter, handled: false, created_at: now() }]);
}

/** Reports the team's managers haven't dealt with yet, with the messages. */
export async function openReports(teamId: string): Promise<(DmReport & { message: DirectMessage | null })[]> {
  const s = db();
  const reports: DmReport[] = s
    ? (check(await s.from("dm_reports").select("*").eq("team_id", teamId).eq("handled", false).order("created_at")) as DmReport[])
    : ((await readLocal()).dm_reports ?? []).filter((r) => r.team_id === teamId && !r.handled);
  const ids = reports.map((r) => r.message_id);
  const msgs: DirectMessage[] = !ids.length
    ? []
    : s
      ? (check(await s.from("direct_messages").select("*").in("id", ids)) as DirectMessage[])
      : ((await readLocal()).direct_messages ?? []).filter((m) => ids.includes(m.id));
  return reports.map((r) => ({ ...r, message: msgs.find((m) => m.id === r.message_id) ?? null }));
}

/** A manager deals with a report: just close it, or also remove the message. */
export async function handleReport(teamId: string, reportId: string, removeMessage: boolean): Promise<void> {
  const report = (await openReports(teamId)).find((r) => r.id === reportId);
  if (!report) return;
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.dm_reports = (d.dm_reports ?? []).map((r) => (r.message_id === report.message_id ? { ...r, handled: true } : r));
    if (removeMessage) d.direct_messages = (d.direct_messages ?? []).map((m) => (m.id === report.message_id ? { ...m, removed: true } : m));
    return writeLocal(d);
  }
  check(await s.from("dm_reports").update({ handled: true }).eq("team_id", teamId).eq("message_id", report.message_id));
  if (removeMessage) check(await s.from("direct_messages").update({ removed: true }).eq("id", report.message_id));
}
