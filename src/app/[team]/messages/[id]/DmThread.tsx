"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockFamily, leaveDm, reportDm, sendDm } from "../../dm-actions";
import { pushEndpoint } from "@/lib/push-endpoint";
import type { DirectMessage } from "@/lib/dms";
import { formatTime, formatWeekday } from "@/lib/time";

const POLL_MS = 4000;

// A private conversation, like WhatsApp: bubbles (yours on the right), new
// messages appear on their own, and the box at the bottom to write.
export function DmThread({
  teamId,
  conversationId,
  me,
  isGroup,
  other,
  otherBlocked,
  blocked,
  names,
  initial,
  tz,
}: {
  teamId: string;
  conversationId: string;
  me: string;
  isGroup: boolean;
  other: string | null; // one-to-one: the other family
  otherBlocked: boolean;
  blocked: string[]; // families this phone blocked (their group messages are hidden)
  names: Record<string, string>;
  initial: DirectMessage[];
  tz: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.created_at;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/${teamId}/messages/${conversationId}/feed${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const fresh: DirectMessage[] = await res.json();
      if (fresh.length) setMessages((m) => [...m, ...fresh.filter((f) => !m.some((x) => x.id === f.id))]);
    } catch {}
  }, [teamId, conversationId, last]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && poll(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [last]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setNote(null);
    start(async () => {
      const res = await sendDm(teamId, conversationId, text, await pushEndpoint());
      if ("error" in res) return setNote(res.error ?? null);
      setDraft("");
      await poll();
    });
  };

  const dayOf = (m: DirectMessage) => formatWeekday(new Date(m.created_at), tz);
  const shown = messages.filter((m) => !blocked.includes(m.author) || m.kind === "system");

  return (
    <>
      <main className="flex-1 space-y-1 px-4 pb-40 pt-3">
        {shown.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">No messages yet. Say hello.</p>}
        {shown.map((m, i) => {
          const day = dayOf(m);
          const showDay = i === 0 || day !== dayOf(shown[i - 1]);
          if (m.kind === "system") {
            return (
              <div key={m.id}>
                {showDay && <div className="py-3 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400">{day}</div>}
                <p className="py-1 text-center text-xs text-zinc-500">{m.body}</p>
              </div>
            );
          }
          const mine = m.author === me;
          const samePrev = i > 0 && shown[i - 1].author === m.author && shown[i - 1].kind === "text" && !showDay;
          return (
            <div key={m.id}>
              {showDay && <div className="py-3 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-400">{day}</div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${samePrev ? "" : "mt-2"}`}>
                  {isGroup && !mine && !samePrev && <div className="mb-0.5 px-1 text-[11px] font-medium text-zinc-500">{names[m.author] ?? "A parent"}</div>}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-snug ${
                      m.removed ? "border border-dashed border-zinc-300 italic text-zinc-400" : mine ? "bg-team text-on-team" : "border border-zinc-200 bg-white"
                    }`}
                  >
                    {m.removed ? "Message removed by a manager" : m.body}
                  </div>
                  <div className={`mt-0.5 flex gap-2 px-1 text-[10px] text-zinc-400 ${mine ? "justify-end" : ""}`}>
                    <span>{formatTime(new Date(m.created_at), tz)}</span>
                    {!mine && !m.removed && (
                      <button
                        type="button"
                        onClick={() =>
                          confirm("Report this message to the team’s managers?") &&
                          start(async () => {
                            const res = await reportDm(teamId, conversationId, m.id);
                            setNote("error" in res ? (res.error ?? null) : "Reported. The team’s managers will have a look.");
                          })
                        }
                        className="underline"
                      >
                        Report
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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-zinc-100/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-md space-y-2 px-3 py-2">
          {otherBlocked ? (
            <p className="py-2 text-center text-sm text-zinc-600">You blocked this family.</p>
          ) : (
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
                maxLength={2000}
                placeholder="Message…"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-base"
              />
              <button disabled={pending || !draft.trim()} className="h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">
                Send
              </button>
            </form>
          )}
          <div className="flex justify-center gap-4 text-xs text-zinc-500">
            {isGroup ? (
              <button
                type="button"
                onClick={() => confirm("Leave this group? You won’t get its messages any more.") && start(async () => {
                  await leaveDm(teamId, conversationId);
                  router.push(`/${teamId}/messages`);
                })}
                className="underline"
              >
                Leave group
              </button>
            ) : (
              other && (
                <button
                  type="button"
                  onClick={() =>
                    confirm(otherBlocked ? `Unblock ${names[other]}?` : `Block ${names[other]}? They can’t message you, and you won’t see their messages in groups.`) &&
                    start(async () => {
                      await blockFamily(teamId, other, !otherBlocked);
                      router.refresh();
                    })
                  }
                  className="underline"
                >
                  {otherBlocked ? "Unblock" : "Block"}
                </button>
              )
            )}
          </div>
          {note && <p className="text-center text-xs text-zinc-600">{note}</p>}
        </div>
      </div>
    </>
  );
}
