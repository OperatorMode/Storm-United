import { randomUUID } from "crypto";
import { check, db, readLocal, writeLocal, type PushSubRow } from "./store";

// Message board (coach announcements + family acknowledgements) and team chat.
// Same pattern as store.ts: Supabase in production, a local JSON file in dev.

export type Announcement = { id: string; body: string; created_at: string; acks: string[] };
export type ChatMessage = { id: string; author_id: string; body: string; created_at: string };

export const COACH_AUTHOR = "coach";

// ---------- announcements ----------

export async function listAnnouncements(teamId: string): Promise<Announcement[]> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    return (data.announcements ?? [])
      .filter((a) => a.team_id === teamId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ id, body, created_at }) => ({
        id,
        body,
        created_at,
        acks: (data.acks ?? []).filter((k) => k.announcement_id === id).map((k) => k.player_id),
      }));
  }
  const rows = check(
    await s
      .from("announcements")
      .select("id, body, created_at, announcement_acks(player_id)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50),
  ) as { id: string; body: string; created_at: string; announcement_acks: { player_id: string }[] }[];
  return rows.map(({ announcement_acks, ...a }) => ({ ...a, acks: announcement_acks.map((k) => k.player_id) }));
}

export async function addAnnouncement(teamId: string, body: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    (data.announcements ??= []).push({ id: randomUUID(), team_id: teamId, body, created_at: new Date().toISOString() });
    return writeLocal(data);
  }
  check(await s.from("announcements").insert({ team_id: teamId, body }));
}

export async function deleteAnnouncement(teamId: string, id: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.announcements = (data.announcements ?? []).filter((a) => !(a.team_id === teamId && a.id === id));
    data.acks = (data.acks ?? []).filter((k) => k.announcement_id !== id);
    return writeLocal(data);
  }
  check(await s.from("announcements").delete().eq("team_id", teamId).eq("id", id));
}

// Returns false if the announcement isn't this team's.
export async function ackAnnouncement(teamId: string, id: string, playerId: string): Promise<boolean> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    if (!(data.announcements ?? []).some((a) => a.team_id === teamId && a.id === id)) return false;
    data.acks = (data.acks ?? []).filter((k) => !(k.announcement_id === id && k.player_id === playerId));
    data.acks.push({ announcement_id: id, player_id: playerId, created_at: new Date().toISOString() });
    await writeLocal(data);
    return true;
  }
  const owner = check(await s.from("announcements").select("id").eq("team_id", teamId).eq("id", id).maybeSingle());
  if (!owner) return false;
  check(
    await s
      .from("announcement_acks")
      .upsert({ announcement_id: id, player_id: playerId }, { onConflict: "announcement_id,player_id" }),
  );
  return true;
}

// ---------- chat ----------

// Oldest first. `after` returns only newer messages (for polling).
export async function listChat(teamId: string, after?: string): Promise<ChatMessage[]> {
  const s = db();
  if (!s) {
    return ((await readLocal()).chat ?? [])
      .filter((m) => m.team_id === teamId && (!after || m.created_at > after))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-200)
      .map(({ id, author_id, body, created_at }) => ({ id, author_id, body, created_at }));
  }
  let q = s.from("chat_messages").select("id, author_id, body, created_at").eq("team_id", teamId);
  if (after) q = q.gt("created_at", after);
  const rows = check(await q.order("created_at", { ascending: false }).limit(200)) as ChatMessage[];
  return rows.reverse();
}

export async function latestChatAt(teamId: string): Promise<string | null> {
  const s = db();
  if (!s) {
    const mine = ((await readLocal()).chat ?? []).filter((m) => m.team_id === teamId);
    return mine.reduce<string | null>((max, m) => (!max || m.created_at > max ? m.created_at : max), null);
  }
  const row = check(
    await s.from("chat_messages").select("created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ) as { created_at: string } | null;
  return row?.created_at ?? null;
}

export async function addChat(teamId: string, authorId: string, body: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    (data.chat ??= []).push({ id: randomUUID(), team_id: teamId, author_id: authorId, body, created_at: new Date().toISOString() });
    return writeLocal(data);
  }
  check(await s.from("chat_messages").insert({ team_id: teamId, author_id: authorId, body }));
}

// Deletes a message; when `authorId` is given, only if they wrote it.
export async function deleteChat(teamId: string, id: string, authorId?: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.chat = (data.chat ?? []).filter(
      (m) => !(m.team_id === teamId && m.id === id && (!authorId || m.author_id === authorId)),
    );
    return writeLocal(data);
  }
  let q = s.from("chat_messages").delete().eq("team_id", teamId).eq("id", id);
  if (authorId) q = q.eq("author_id", authorId);
  check(await q);
}

// ---------- push subscriptions ----------

export async function getPushSubs(teamId: string): Promise<PushSubRow[]> {
  const s = db();
  if (!s) return ((await readLocal()).subs ?? []).filter((x) => x.team_id === teamId);
  return check(
    await s
      .from("push_subscriptions")
      .select("endpoint, team_id, author_id, p256dh, auth, notify_board, notify_chat")
      .eq("team_id", teamId),
  );
}

export async function getPushSub(teamId: string, endpoint: string): Promise<PushSubRow | null> {
  return (await getPushSubs(teamId)).find((x) => x.endpoint === endpoint) ?? null;
}

export async function savePushSub(row: PushSubRow): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.subs = [...(data.subs ?? []).filter((x) => !(x.endpoint === row.endpoint && x.team_id === row.team_id)), row];
    return writeLocal(data);
  }
  check(await s.from("push_subscriptions").upsert(row, { onConflict: "endpoint,team_id" }));
}

export async function deletePushSub(teamId: string, endpoint: string): Promise<void> {
  const s = db();
  if (!s) {
    const data = await readLocal();
    data.subs = (data.subs ?? []).filter((x) => !(x.endpoint === endpoint && x.team_id === teamId));
    return writeLocal(data);
  }
  check(await s.from("push_subscriptions").delete().eq("team_id", teamId).eq("endpoint", endpoint));
}
