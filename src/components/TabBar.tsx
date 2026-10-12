"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const chatSeenKey = (teamId: string) => `su_chat_seen_${teamId}`;

// Bottom navigation: Home · Board · Chat · Messages · Manager, with unread badges.
// Manager opens Manager’s Corner (PIN-protected), so parents can safely see it.
// Board badge = announcements this family hasn't acknowledged (from the server).
// Chat badge = messages newer than the last time this phone opened the chat.
export function TabBar({
  teamId,
  active,
  boardUnread,
  latestChatAt,
  messagesUnread = 0,
  kind = "team",
  manager = false,
}: {
  teamId: string;
  active: "home" | "board" | "chat" | "messages" | "manager" | "game";
  boardUnread: number;
  latestChatAt: string | null;
  messagesUnread?: number; // private messages not read yet
  kind?: "team" | "event"; // an event: Announcements and Organiser instead of Board and Manager
  manager?: boolean; // a team's manager on this phone: also the My Game tab
}) {
  const [chatUnread, setChatUnread] = useState(false);
  useEffect(() => {
    if (active === "chat" || !latestChatAt) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(chatSeenKey(teamId));
    } catch {}
    const unread = !seen || latestChatAt > seen;
    queueMicrotask(() => setChatUnread(unread));
  }, [teamId, active, latestChatAt]);

  const tabs = [
    { key: "home", href: `/${teamId}`, label: "Home", icon: HomeIcon, badge: 0 },
    { key: "board", href: `/${teamId}/board`, label: kind === "event" ? "News" : "Board", icon: BoardIcon, badge: boardUnread },
    { key: "chat", href: `/${teamId}/chat`, label: "Chat", icon: ChatIcon, badge: chatUnread ? -1 : 0 },
    { key: "messages", href: `/${teamId}/messages`, label: "Private", icon: MessagesIcon, badge: messagesUnread },
    ...(manager && kind === "team" ? [{ key: "game", href: `/${teamId}/game`, label: "Game", icon: BallIcon, badge: 0 }] : []),
    { key: "manager", href: `/${teamId}/admin`, label: kind === "event" ? "Organiser" : "Manager", icon: WhistleIcon, badge: 0 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className={`mx-auto grid max-w-md ${tabs.length === 6 ? "grid-cols-6" : "grid-cols-5"}`}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? "text-zinc-950" : "text-zinc-400"}`}
              >
                <span className="relative">
                  <t.icon />
                  {t.badge !== 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-on-accent">
                      {t.badge > 0 ? t.badge : ""}
                    </span>
                  )}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const iconProps = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function HomeIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function BoardIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}
function BallIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10z" />
      <path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" />
    </svg>
  );
}
function WhistleIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="14" r="5" />
      <path d="M12.5 10.5 21 7v4l-6.5 2M4 9V4M2 6h4" />
    </svg>
  );
}
function MessagesIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6h16v10H8l-4 4z" />
      <path d="m4 6 8 6 8-6" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 24 24" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
