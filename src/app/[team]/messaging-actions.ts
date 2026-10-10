"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTeam, firstName, playerName, type Team } from "@/lib/teams";
import { canView, chatAuthor, currentChildren, currentVoter, isTeamAdmin } from "@/lib/session";
import {
  COACH_AUTHOR,
  ackAnnouncement,
  addAnnouncement,
  addChat,
  deleteAnnouncement,
  deleteChat,
  deletePushSub,
  getPushSub,
  handleChatReport,
  listChat,
  reportChatMessage,
  savePushSub,
} from "@/lib/messages";
import { notifyManagers, notifyTeam, preview, pushEnabled, sendPush } from "@/lib/push";

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
  const fromEndpoint = String(formData.get("from_endpoint") ?? "") || null;
  after(() =>
    notifyTeam(
      team.id,
      "board",
      { title: `${team.name}`, body: preview(body), url: `/${team.id}/board`, icon: `/${team.id}/icon/192` },
      { endpoint: fromEndpoint, author: COACH_AUTHOR },
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
  const children = await currentChildren(team);
  if (!children.length) return { error: "Pick your child first." };
  for (const child of children) {
    if (!(await ackAnnouncement(team.id, id, child))) return { error: "Message not found." };
  }
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// ---------- chat ----------

export async function sendChat(teamId: string, body: string, fromEndpoint: string | null = null) {
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
      { endpoint: fromEndpoint, author },
    ),
  );
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// Authors can delete their own messages; the coach can delete any.
/** Report a team chat message: the managers see it in Manager's Corner and get a notification. */
export async function reportChat(teamId: string, id: string) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  const me = await chatAuthor(team);
  if (!me) return { error: "Pick your child on Home first." };
  if (!(await listChat(team.id)).some((m) => m.id === id)) return { error: "Message not found." };
  await reportChatMessage(team.id, id, me);
  after(() =>
    notifyManagers(team.id, {
      title: `${team.name}: a chat message was reported`,
      body: "Open Manager’s Corner to see it.",
      url: `/${team.id}/admin`,
      icon: `/${team.id}/icon/192`,
    }),
  );
  return { ok: true };
}

/** Manager's Corner: deal with a chat report (remove the message, or keep it). */
export async function resolveChatReport(teamId: string, reportId: string, remove: boolean) {
  const team = await viewableTeam(teamId);
  if (!team || !(await isTeamAdmin(team))) return;
  await handleChatReport(team.id, reportId, remove);
  revalidatePath(`/${team.id}`, "layout");
}

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
  prefs: { board: boolean; chat: boolean; games: boolean; reminders: boolean; dm?: boolean },
) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Invalid subscription." };
  if (!prefs.board && !prefs.chat && !prefs.games && !prefs.reminders && !prefs.dm) {
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
    notify_games: prefs.games,
    notify_reminders: prefs.reminders,
    notify_dm: prefs.dm !== false,
    children: (await currentChildren(team)).join(",") || null,
  });
  return { ok: true };
}

export async function getPushPrefs(teamId: string, endpoint: string) {
  const team = await viewableTeam(teamId);
  if (!team) return null;
  const sub = await getPushSub(team.id, endpoint);
  if (!sub) return null;
  // Keep the phone's children up to date for personal reminders.
  const children = (await currentChildren(team)).join(",") || null;
  if ((sub.children ?? null) !== children) await savePushSub({ ...sub, children });
  return {
    board: sub.notify_board,
    chat: sub.notify_chat,
    games: sub.notify_games !== false,
    reminders: sub.notify_reminders !== false,
    dm: sub.notify_dm !== false,
  };
}

// "Send a test notification" to this phone only, to check notifications work.
export async function sendTestPush(teamId: string, endpoint: string) {
  const team = await viewableTeam(teamId);
  if (!team) return { error: "Team not found." };
  const sub = await getPushSub(team.id, endpoint);
  if (!sub) return { error: "Notifications aren’t switched on for this team on this phone yet." };
  if (!pushEnabled()) return { error: "Notifications aren’t set up on the server." };
  await sendPush(sub, {
    title: `${team.name}: test`,
    body: "Notifications work on this phone.",
    url: `/${team.id}`,
    icon: `/${team.id}/icon/192`,
    tag: `${team.id}-test`,
  });
  return { ok: true };
}
