"use client";

import { useState, useTransition } from "react";
import { joinActivities, reimportActivity, removeActivity, shareActivities, toggleSession } from "./activity-actions";
import { kidKey } from "@/lib/kid-key";

export type ActivityRow = { id: string; name: string; person: string; schedule: string; imported: boolean; error: string | null; linked: boolean };

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
              <span className="block text-xs text-zinc-500">
                {r.schedule}
                {r.linked && " · shared with this phone"}
              </span>
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
                onClick={() =>
                  confirm(r.linked ? `Remove ${r.name} from this phone? The phone that shared it keeps it.` : `Remove ${r.person}’s ${r.name}?`) &&
                  start(() => removeActivity(r.id))
                }
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

// Share activities with another phone (a partner's): all of them (both phones
// then share everything, including ones added later) or just the chosen ones.
// Or enter a code from another phone.
export function ShareActivities({ activities }: { activities: { id: string; label: string }[] }) {
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [code, setCode] = useState<{ code: string; all: boolean } | null>(null);
  const [entered, setEntered] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  return (
    <div className="space-y-4 text-sm">
      {activities.length > 0 &&
        (code ? (
          <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
            <p>
              On the other phone, open My Activities, then Share with another phone, and enter{" "}
              <b className="font-mono text-base tracking-widest">{code.code}</b>. It works for 24 hours.
            </p>
            <p className="text-xs text-zinc-500">
              {code.all ? "Both phones will share all activities, including ones added later." : "Only the activities you ticked are shared."}
            </p>
            <button type="button" onClick={() => setCode(null)} className="text-xs text-zinc-600 underline">
              Share something else
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="block font-medium">Share with another phone</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
              {[
                { value: true, label: "All activities" },
                { value: false, label: "Choose" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setAll(o.value)}
                  className={`rounded-lg px-2 py-1.5 font-medium ${all === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {!all && (
              <ul className="space-y-1">
                {activities.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={chosen.includes(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-zinc-900" />
                      {a.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={pending || (!all && !chosen.length)}
              onClick={() =>
                start(async () => {
                  const res = await shareActivities(all ? null : chosen);
                  if ("error" in res) return setMsg(res.error ?? null);
                  setMsg(null);
                  setCode({ code: res.code, all: res.all });
                })
              }
              className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
            >
              Get a code
            </button>
          </div>
        ))}
      <div className="space-y-1">
        <span className="block font-medium">Got a code from another phone?</span>
        <div className="flex gap-2">
          <input
            value={entered}
            onChange={(e) => setEntered(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="6 letters"
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
                setMsg(
                  "error" in res
                    ? (res.error ?? null)
                    : "count" in res
                      ? `Added ${res.count} shared activit${res.count === 1 ? "y" : "ies"}.`
                      : "Linked. Both phones now share all activities.",
                );
                if (!("error" in res)) setEntered("");
              })
            }
            className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
          >
            Add
          </button>
        </div>
      </div>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
