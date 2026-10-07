"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { removeChat, sendChat } from "../messaging-actions";
import { chatSeenKey } from "@/components/TabBar";
import { pushEndpoint } from "@/lib/push-endpoint";
import type { ChatMessage } from "@/lib/messages";
import { formatTime, formatWeekday } from "@/lib/time";

const POLL_MS = 5000;


export function ChatThread({
  teamId,
  me,
  isCoach,
  names,
  initial,
  tz,
}: {
  teamId: string;
  me: string | null;
  isCoach: boolean;
  names: Record<string, string>;
  initial: ChatMessage[];
  tz: string;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.created_at;

  const label = (id: string) => (id === "coach" ? "Coach" : (names[id] ?? "A parent"));

  // Fetch anything newer than what we have.
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/${teamId}/chat/feed${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const fresh: ChatMessage[] = await res.json();
      if (fresh.length) setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
    } catch {}
  }, [teamId, last]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && poll(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Keep scrolled to the newest message and remember what this phone has seen.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    try {
      localStorage.setItem(chatSeenKey(teamId), last ?? new Date().toISOString());
    } catch {}
  }, [teamId, last]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    start(async () => {
      const res = await sendChat(teamId, text, await pushEndpoint());
      if (res.error) return setError(res.error);
      setDraft("");
      await poll();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    setMessages((m) => m.filter((x) => x.id !== id));
    start(() => removeChat(teamId, id));
  }

  const dayOf = (m: ChatMessage) => formatWeekday(new Date(m.created_at), tz);
  return (
    <>
      <main className="flex-1 space-y-1 px-4 pb-44 pt-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">No messages yet. Say hi to the team.</p>
        )}
        {messages.map((m, i) => {
          const mine = m.author_id === me;
          const day = dayOf(m);
          const showDay = i === 0 || day !== dayOf(messages[i - 1]);
          const sameAuthorAsPrev = i > 0 && messages[i - 1].author_id === m.author_id && !showDay;
          return (
            <div key={m.id}>
              {showDay && <div className="py-3 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400">{day}</div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${sameAuthorAsPrev ? "" : "mt-2"}`}>
                  {!mine && !sameAuthorAsPrev && (
                    <div className={`mb-0.5 px-1 text-[11px] font-medium ${m.author_id === "coach" ? "text-accent" : "text-zinc-500"}`}>
                      {label(m.author_id)}
                    </div>
                  )}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-snug ${
                      mine ? "bg-team text-on-team" : "border border-zinc-200 bg-white"
                    }`}
                  >
                    {m.body}
                  </div>
                  <div className={`mt-0.5 flex gap-2 px-1 text-[10px] text-zinc-400 ${mine ? "justify-end" : ""}`}>
                    <span>{formatTime(new Date(m.created_at), tz)}</span>
                    {(mine || isCoach) && (
                      <button type="button" onClick={() => remove(m.id)} className="underline">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </main>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.4rem)] z-10 border-t border-zinc-200 bg-zinc-100/95 backdrop-blur">
        <div className="mx-auto max-w-md px-3 py-2">
          {me ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                maxLength={1000}
                placeholder={isCoach ? "Message the team as Coach…" : "Message the team…"}
                className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-base"
              />
              <button
                disabled={pending || !draft.trim()}
                className="h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40"
              >
                Send
              </button>
            </form>
          ) : (
            <p className="py-2 text-center text-sm text-zinc-600">
              <Link href={`/${teamId}`} className="font-medium underline">
                Pick your child on Home
              </Link>{" "}
              to join the chat.
            </p>
          )}
          {error && <p className="px-1 pt-1 text-xs text-accent">{error}</p>}
        </div>
      </div>
    </>
  );
}
