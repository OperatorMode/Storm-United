"use client";

import { useState, useTransition } from "react";
import { joinActivities, reimportActivity, removeActivity, shareActivities, toggleSession } from "./activity-actions";
import { kidKey } from "@/lib/kid-key";
import { ActivityForm, type ActivityInitial } from "./ActivityForm";

export type ActivityRow = {
  id: string;
  name: string;
  person: string;
  schedule: string;
  imported: boolean;
  error: string | null;
  linked: boolean;
  edit: ActivityInitial; // the form, filled in, for Edit
};

// The family's activities: what's set up; edit, update (imported) or remove one.
export function ActivityList({ rows, people }: { rows: ActivityRow[]; people: string[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
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
              <button type="button" onClick={() => setEditing(editing === r.id ? null : r.id)} className="text-zinc-600 underline">
                {editing === r.id ? "Close" : "Edit"}
              </button>
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
          {editing === r.id && (
            <div className="mt-3 rounded-xl bg-zinc-50 p-3">
              <ActivityForm people={people} initial={r.edit} onDone={() => setEditing(null)} />
            </div>
          )}
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
// The code works once, within 24 hours: copy it, or send an invitation with a
// link that opens Sidelnr with the code ready to add.
export function ShareActivities({ activities }: { activities: { id: string; label: string }[] }) {
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [code, setCode] = useState<{ code: string; all: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (!activities.length) return <p className="text-sm text-zinc-500">Add an activity first, then share it from here.</p>;

  const invitation = (c: string) =>
    `I’ve shared our activities with you on Sidelnr. Tap to add them: ${window.location.origin}/me?join=${c}\n\n` +
    `Or open Sidelnr, go to My Activities and enter the code ${c} under “Got a code?”. It works once, within 24 hours.`;
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(done);
    } catch {
      setMsg("Couldn’t copy. Press and hold the code to copy it.");
    }
  };
  const share = async (c: string) => {
    const text = invitation(c);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Sidelnr activities", text });
        return;
      } catch {
        return; // cancelled
      }
    }
    await copy(text, "Invitation copied. Paste it into a message.");
  };

  return (
    <div className="space-y-3 text-sm">
      {code ? (
        <div className="space-y-3 rounded-xl bg-zinc-50 p-3">
          <p className="text-center font-mono text-2xl font-bold tracking-widest select-all">{code.code}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => copy(code.code, "Code copied.")} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 font-medium">
              Copy code
            </button>
            <button type="button" onClick={() => share(code.code)} className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white">
              Share invitation
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Works once, within 24 hours. {code.all ? "Both phones will share all activities, including ones added later." : "Only the activities you ticked are shared."}
          </p>
          <button type="button" onClick={() => setCode(null)} className="text-xs text-zinc-600 underline">
            Make another code
          </button>
        </div>
      ) : (
        <div className="space-y-2">
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
            className="w-full rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
          >
            Get a code
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}

// Entering a code from another phone. `initial` comes from an invitation link
// (/me?join=…); nothing is used up until "Add" is tapped.
export function JoinCode({ initial = "", highlight = false }: { initial?: string; highlight?: boolean }) {
  const format = (v: string) => {
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  };
  const [entered, setEntered] = useState(format(initial));
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = entered.replace("-", "").length === 8;
  return (
    <div className={`space-y-2 text-sm ${highlight ? "rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-sm" : ""}`}>
      <span className="block font-medium">{highlight ? "Activities were shared with you" : "Got a code from another phone?"}</span>
      {highlight && <span className="block text-xs text-zinc-500">Tap Add to see them in My Activities on this phone.</span>}
      <div className="flex gap-2">
        <input
          value={entered}
          onChange={(e) => setEntered(format(e.target.value))}
          placeholder="ABCD-EFGH"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Share code"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-base tracking-widest"
        />
        <button
          type="button"
          disabled={pending || !ready || !!msg?.ok}
          onClick={() =>
            start(async () => {
              const res = await joinActivities(entered);
              setMsg(
                "error" in res
                  ? { error: res.error }
                  : { ok: "count" in res ? `Added ${res.count} shared activit${res.count === 1 ? "y" : "ies"}.` : "Linked. Both phones now share all activities." },
              );
            })
          }
          className="rounded-xl bg-zinc-900 px-4 py-2 font-semibold text-white disabled:opacity-30"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {msg?.error && <p className="text-xs text-accent">{msg.error}</p>}
      {msg?.ok && <p className="text-xs text-emerald-700">{msg.ok}</p>}
    </div>
  );
}
