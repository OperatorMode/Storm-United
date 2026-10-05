import { latestChatAt, listAnnouncements } from "./messages";
import { currentVoter } from "./session";
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
    };
  } catch (err) {
    console.error("tab badges unavailable", err);
    return { boardUnread: 0, latestChatAt: null };
  }
}

const WHEN = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Perth",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
export function formatWhen(iso: string): string {
  return WHEN.format(new Date(iso));
}
