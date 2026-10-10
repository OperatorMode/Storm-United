"use client";

import { useState, useTransition } from "react";
import { joinActivities, reimportActivity, removeActivity, shareActivities, toggleSession } from "./activity-actions";
import { kidKey } from "@/lib/kid-key";

export type ActivityRow = { id: string; name: string; person: string; schedule: string; imported: boolean; error: string | null };

// The family's activities: what's set up, update an imported one, remove one.
export function ActivityList({ rows }: { rows: ActivityRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (!rows.length) return null;
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="py-2.5">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-medium">
                <b data-kid={kidKey(r.person)} style={{ color: "var(--kid)" }}>
                  {r.person}
                </b>{" "}
                · {r.name}
              </span>
              <span className="block text-xs text-zinc-500">{r.schedule}</span>
              {r.error && <span className="block text-xs text-accent">Last update failed: {r.error}</span>}
              {msg[r.id] && <span className="block text-xs text-zinc-600">{msg[r.id]}</span>}
            </span>
            <span className="flex shrink-0 gap-3 text-xs">
              {r.imported && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await reimportActivity(r.id);
                      setMsg((m) => ({ ...m, [r.id]: "error" in res ? res.error! : `Up to date: ${res.count} sessions.` }));
                    })
                  }
                  className="text-zinc-600 underline"
                >
                  Update
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm(`Remove ${r.person}’s ${r.name}?`) && start(() => removeActivity(r.id))}
                className="text-red-700 underline"
              >
                Remove
              </button>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Cancel one session ("no lesson this week"), or bring it back.
export function SessionToggle({ activityId, start: at, cancelled }: { activityId: string; start: string; cancelled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => toggleSession(activityId, at))} className="text-xs text-zinc-500 underline">
      {cancelled ? "Undo cancel" : "Not on this time"}
    </button>
  );
}

// Share the family's activities with another phone (a partner's), or join theirs.
export function ShareActivities({ hasActivities }: { hasActivities: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [entered, setEntered] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 text-sm">
      {hasActivities && (
        <div>
          {code ? (
            <p>
              On the other phone, open My Activities and enter <b className="font-mono text-base tracking-widest">{code}</b>. It works for 24
              hours.
            </p>
          ) : (
            <button type="button" disabled={pending} onClick={() => start(async () => setCode((await shareActivities()).code))} className="font-medium underline">
              Share with another phone
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={entered}
          onChange={(e) => setEntered(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          placeholder="Got a code?"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-base tracking-widest"
        />
        <button
          type="button"
          disabled={pending || entered.length !== 6}
          onClick={() =>
            start(async () => {
              const res = await joinActivities(entered);
              setMsg("error" in res ? res.error! : "Linked. You now see the same activities on both phones.");
            })
          }
          className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
        >
          Link
        </button>
      </div>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
