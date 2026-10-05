import { latestChatAt, listAnnouncements } from "./messages";

// Data the bottom tab bar needs for its unread badges.
export async function tabData(teamId: string, voter: string | null) {
  const [announcements, chatAt] = await Promise.all([listAnnouncements(teamId), latestChatAt(teamId)]);
  return {
    boardUnread: voter ? announcements.filter((a) => !a.acks.includes(voter)).length : 0,
    latestChatAt: chatAt,
  };
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
