"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getTeam, isActivePlayer } from "@/lib/teams";
import { canView, dmIdentities, isTeamAdmin } from "@/lib/session";
import { getPushSubs } from "@/lib/messages";
import { notifyManagers, preview, sendPush } from "@/lib/push";
import {
  COACH,
  MAX_GROUP,
  addMessage,
  blockedBetween,
  blocksBy,
  getConversation,
  handleReport,
  leaveConversation,
  markRead,
  memberLabel,
  membersOf,
  messagesIn,
  reportMessage,
  setBlock,
  startConversation,
} from "@/lib/dms";

// Private messages between families (parents only) and with the coach.

async function context(teamId: string) {
  const team = await getTeam(teamId);
  if (!team || !(await canView(team))) return null;
  const ids = await dmIdentities(team);
  if (!ids?.length) return null; // players' own phones, or no child picked yet
  return { team, ids };
}

/** The conversation, and which of this phone's identities is in it. */
async function membership(teamId: string, conversationId: string) {
  const ctx = await context(teamId);
  if (!ctx) return null;
  const conv = await getConversation(ctx.team.id, conversationId);
  if (!conv) return null;
  const members = await membersOf([conv.id]);
  const me = members.find((m) => ctx.ids.includes(m.member) && !m.left_at);
  if (!me) return null;
  return { ...ctx, conv, members, me: me.member };
}

const valid = (team: NonNullable<Awaited<ReturnType<typeof getTeam>>>, m: string) => m === COACH || isActivePlayer(team, m);

export async function startDm(teamId: string, others: string[], name: string | null) {
  const ctx = await context(teamId);
  if (!ctx) return { error: "Pick your child on Home first." };
  const me = ctx.ids.find((i) => i !== COACH) ?? ctx.ids[0];
  const people = [...new Set(others)].filter((o) => valid(ctx.team, o) && !ctx.ids.includes(o));
  if (!people.length) return { error: "Choose who to message." };
  if (people.length > MAX_GROUP - 1) return { error: `A group can have up to ${MAX_GROUP} families.` };
  // Nobody can be messaged or added to a group by a family they blocked (or who blocked them).
  for (const p of people) {
    if (await blockedBetween(ctx.team.id, ctx.ids, [p])) return { error: `You can’t message ${memberLabel(ctx.team, p)}.` };
  }
  const id = await startConversation(ctx.team.id, me, people, people.length > 1 ? (name?.trim() || null) : null);
  return { id };
}

export async function sendDm(teamId: string, conversationId: string, body: string, fromEndpoint: string | null) {
  const m = await membership(teamId, conversationId);
  if (!m) return { error: "This conversation isn’t open to you." };
  const text = body.trim();
  if (!text) return { error: "Write something first." };
  if (text.length > 2000) return { error: "Keep it under 2000 characters." };
  const others = m.members.filter((x) => !x.left_at && x.member !== m.me).map((x) => x.member);
  if (!m.conv.is_group && (!others.length || (await blockedBetween(m.team.id, [m.me], others)))) {
    return { error: "You can’t message this family." };
  }
  const msg = await addMessage(m.conv.id, m.me, text);
  await markRead(m.conv.id, m.me);

  // Notify the other members' phones (not this one, and not families who blocked the sender).
  after(async () => {
    const blockedSender = new Set<string>();
    for (const o of others) if ((await blocksBy(m.team.id, [o])).includes(m.me)) blockedSender.add(o);
    const recipients = others.filter((o) => !blockedSender.has(o));
    const subs = (await getPushSubs(m.team.id)).filter((s) => {
      if (s.notify_dm === false || s.endpoint === fromEndpoint) return false;
      const kids = (s.children ?? "").split(",");
      return recipients.some((r) => (r === COACH ? s.author_id === COACH : kids.includes(r)));
    });
    const from = memberLabel(m.team, m.me);
    const title = m.conv.is_group ? (m.conv.name ?? "Group") : from;
    await Promise.allSettled(
      subs.map((s) =>
        sendPush(s, {
          title,
          body: m.conv.is_group ? `${from}: ${preview(msg.body)}` : preview(msg.body),
          url: `/${m.team.id}/messages/${m.conv.id}`,
          icon: `/${m.team.id}/icon/192`,
          tag: `${m.team.id}-dm-${m.conv.id}`,
        }),
      ),
    );
  });
  revalidatePath(`/${m.team.id}/messages`);
  return { ok: true };
}

export async function readDm(teamId: string, conversationId: string) {
  const m = await membership(teamId, conversationId);
  if (m) await markRead(m.conv.id, m.me);
}

export async function leaveDm(teamId: string, conversationId: string) {
  const m = await membership(teamId, conversationId);
  if (!m) return;
  await addMessage(m.conv.id, m.me, `${memberLabel(m.team, m.me)} left`, "system");
  await leaveConversation(m.conv.id, m.me);
  revalidatePath(`/${m.team.id}/messages`);
}

/** Block (or unblock) a family: they can't message this family, and their group messages are hidden. */
export async function blockFamily(teamId: string, member: string, on: boolean) {
  const ctx = await context(teamId);
  if (!ctx || !valid(ctx.team, member) || ctx.ids.includes(member)) return { error: "Not allowed." };
  for (const me of ctx.ids) await setBlock(ctx.team.id, me, member, on);
  revalidatePath(`/${ctx.team.id}/messages`, "layout");
  return { ok: true };
}

/** Report a message: the team's managers see it in Manager's Corner and get a notification. */
export async function reportDm(teamId: string, conversationId: string, messageId: string) {
  const m = await membership(teamId, conversationId);
  if (!m) return { error: "Not allowed." };
  if (!(await messagesIn(m.conv.id)).some((x) => x.id === messageId)) return { error: "Message not found." };
  await reportMessage(m.team.id, messageId, m.me);
  after(() =>
    notifyManagers(m.team.id, {
      title: `${m.team.name}: a message was reported`,
      body: "Open Manager’s Corner to see it.",
      url: `/${m.team.id}/admin`,
      icon: `/${m.team.id}/icon/192`,
    }),
  );
  return { ok: true };
}

/** Manager's Corner: close a report, optionally removing the message. */
export async function resolveDmReport(teamId: string, reportId: string, remove: boolean) {
  const team = await getTeam(teamId);
  if (!team || !(await isTeamAdmin(team))) return;
  await handleReport(team.id, reportId, remove);
  revalidatePath(`/${team.id}/admin`);
}
