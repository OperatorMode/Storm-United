"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTeam, firstName, playerName, type Team } from "@/lib/teams";
import { canView, chatAuthor, currentVoter, isTeamAdmin } from "@/lib/session";
import {
  COACH_AUTHOR,
  ackAnnouncement,
  addAnnouncement,
  addChat,
  deleteAnnouncement,
  deleteChat,
  deletePushSub,
  getPushSub,
  savePushSub,
} from "@/lib/messages";
import { notifyTeam, preview } from "@/lib/push";

async function viewableTeam(teamId: string): Promise<Team | null> {
  const team = await getTeam(teamId);
  return team && (await canView(team)) ? team : null;
}

function authorLabel(team: Team, authorId: string): string {
  return authorId === COACH_AUTHOR ? "Coach" : `${firstName(playerName(team, authorId))}'s parent`;
}

// ---------- message board ----------

export async function postAnnouncement(teamId: string, _: unknown, formData: FormData) {
  const team = await getTeam(teamId);
  if (!team || !(await isTeamAdmin(team))) return { error: "Only the coach can post here." };
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  if (body.length > 2000) return { error: "Keep it under 2000 characters." };
  await addAnnouncement(team.id, body);
  after(() =>
    notifyTeam(
      team.id,
      "board",
      { title: `${team.name}`, body: preview(body), url: `/${team.id}/board`, icon: `/${team.id}/icon/192` },
      COACH_AUTHOR,
    ),
  );
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

export async function removeAnnouncement(teamId: string, id: string) {
  const team = await getTeam(teamId);
  if (!team || !(await isTeamAdmin(team))) return;
  await deleteAnnouncement(team.id, id);
  revalidatePath(`/${team.id}`, "layout");
}

export async function acknowledge(teamId: string, id: string) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  const voter = await currentVoter(team);
  if (!voter) return { error: "Pick your child first." };
  if (!(await ackAnnouncement(team.id, id, voter))) return { error: "Message not found." };
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// ---------- chat ----------

export async function sendChat(teamId: string, body: string) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  const author = await chatAuthor(team);
  if (!author) return { error: "Pick your child first." };
  const text = body.trim();
  if (!text) return { error: "Write something first." };
  if (text.length > 1000) return { error: "Keep it under 1000 characters." };
  await addChat(team.id, author, text);
  after(() =>
    notifyTeam(
      team.id,
      "chat",
      {
        title: `${authorLabel(team, author)}`,
        body: preview(text),
        url: `/${team.id}/chat`,
        icon: `/${team.id}/icon/192`,
      },
      author,
    ),
  );
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// Authors can delete their own messages; the coach can delete any.
export async function removeChat(teamId: string, id: string) {
  const team = await viewableTeam(teamId);
  if (!team) return;
  if (await isTeamAdmin(team)) await deleteChat(team.id, id);
  else {
    const author = await currentVoter(team);
    if (author) await deleteChat(team.id, id, author);
  }
  revalidatePath(`/${team.id}`, "layout");
}

// ---------- notifications ----------

type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscription(
  teamId: string,
  sub: BrowserSubscription,
  prefs: { board: boolean; chat: boolean },
) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Invalid subscription." };
  if (!prefs.board && !prefs.chat) {
    await deletePushSub(team.id, sub.endpoint);
    return { ok: true };
  }
  await savePushSub({
    endpoint: sub.endpoint,
    team_id: team.id,
    author_id: await chatAuthor(team),
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    notify_board: prefs.board,
    notify_chat: prefs.chat,
  });
  return { ok: true };
}

export async function getPushPrefs(teamId: string, endpoint: string) {
  const team = await viewableTeam(teamId);
  if (!team) return null;
  const sub = await getPushSub(team.id, endpoint);
  return sub ? { board: sub.notify_board, chat: sub.notify_chat } : null;
}
