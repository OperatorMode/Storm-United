import { latestChatAt, listAnnouncements } from "./messages";
import { currentVoter, dmIdentities } from "./session";
import { blocksBy, conversationsFor, unreadCounts } from "./dms";
import type { Team } from "./teams";

// Data the bottom tab bar needs for its unread badges. Badges are a nicety:
// if messaging data can't be read, the page still renders without them.
export async function tabData(team: Team) {
  try {
    const [announcements, chatAt, voter] = await Promise.all([
      listAnnouncements(team.id),
      latestChatAt(team.id),
      currentVoter(team),
    ]);
    return {
      boardUnread: voter ? announcements.filter((a) => !a.acks.includes(voter)).length : 0,
      latestChatAt: chatAt,
      messagesUnread: await messagesUnread(team),
    };
  } catch (err) {
    console.error("tab badges unavailable", err);
    return { boardUnread: 0, latestChatAt: null, messagesUnread: 0 };
  }
}

/** Unread private messages for this phone (0 for players' own phones). */
async function messagesUnread(team: Team): Promise<number> {
  try {
    const ids = await dmIdentities(team);
    if (!ids?.length) return 0;
    const convs = await conversationsFor(team.id, ids);
    if (!convs.length) return 0;
    const counts = await unreadCounts(convs.map((c) => c.id), ids, await blocksBy(team.id, ids));
    return Object.values(counts).reduce((a, b) => a + b, 0);
  } catch {
    return 0; // e.g. before migration 023
  }
}

export { formatWhen } from "./time";
