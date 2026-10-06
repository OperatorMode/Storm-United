"use client";

import { useEffect, useState } from "react";
import { chatSeenKey } from "./TabBar";

// Red counter next to a team on the home page: coach messages this family
// hasn't acknowledged, plus chat messages since this phone last opened the chat.
export function TeamBadge({ teamId, boardUnread, chatTimes }: { teamId: string; boardUnread: number; chatTimes: string[] }) {
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(chatSeenKey(teamId));
    } catch {}
    const count = seen ? chatTimes.filter((t) => t > seen).length : chatTimes.length;
    queueMicrotask(() => setChatUnread(count));
  }, [teamId, chatTimes]);

  const total = boardUnread + chatUnread;
  if (!total) return null;
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white" aria-label={`${total} new`}>
      {total > 99 ? "99+" : total}
    </span>
  );
}
