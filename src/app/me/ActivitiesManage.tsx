"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinActivities, reimportActivity, removeActivity, shareActivities, toggleSession, leaveSharedEvent, shareEvent } from "./activity-actions";
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
  mine: boolean; // created on this phone: only then can it be deleted for everyone
  edit: ActivityInitial; // the form, filled in, for Edit
};

// The family's activities: what's set up; edit, update (imported) or remove one.
export function ActivityList({ rows, people }: { rows: ActivityRow[]; people: string[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null); // asking "this phone or everyone?"
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
                onClick={() => {
                  // Created here: ask whether it goes for everyone it's shared with, or just this phone.
                  if (r.mine && !r.linked) return setRemoving(removing === r.id ? null : r.id);
                  if (confirm(`Remove ${r.name} from this phone? Anyone it’s shared with keeps it.`)) start(() => removeActivity(r.id));
                }}
                className="text-red-700 underline"
              >
                Remove
              </button>
            </span>
          </div>
          {removing === r.id && (
            <div className="mt-2 space-y-2 rounded-xl bg-red-50 p-3 text-xs text-red-900">
              <p>Remove {r.name}?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => removeActivity(r.id, false))}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium"
                >
                  Just this phone
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => removeActivity(r.id, true))}
                  className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white"
                >
                  Everyone
                </button>
                <button type="button" onClick={() => setRemoving(null)} className="px-2 py-1.5 underline">
                  Cancel
                </button>
              </div>
            </div>
          )}
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
      {cancelled ? "Undo" : "Skip this time"}
    </button>
  );
}

// A shared event (from another family): leave one date, or the whole event,
// for this family only. The family that shared it keeps it.
export function LeaveShared({ activityId, start: at, single, name }: { activityId: string; start: string; single: boolean; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const leave = (iso: string | null, question: string) =>
    confirm(question) &&
    start(async () => {
      await leaveSharedEvent(activityId, iso);
      router.refresh();
    });
  return (
    <span className="flex gap-3 text-xs text-zinc-500">
      {!single && (
        <button type="button" disabled={pending} onClick={() => leave(at, `Leave ${name} on this date? Only for your family: it stays for the family that shared it.`)} className="underline">
          Leave this date
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => leave(null, `Leave ${name}${single ? "" : " (every date)"}? It comes off your family’s My Activities. It stays for the family that shared it.`)}
        className="underline"
      >
        Leave event
      </button>
    </span>
  );
}

// Two different things, kept apart so it's always clear which is which:
//  - Join our family: the other phone becomes part of this family and sees every
//    event in My Activities, now and later (the other parent, a grandparent).
//  - Share one event: just that event (every time, or one date). The other
//    family gets it as a Shared event in their own My Activities and doesn't
//    join this family; they can leave it any time.
// Each code works once, within 24 hours: copy it, or send an invitation with a
// link that opens Sidelnr with the code ready to add.
export type Shareable = { id: string; label: string; name: string; dates: { iso: string; label: string }[] };

function CodeBox({ code, text, note, again }: { code: string; text: string; note: string; again: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const copy = async (t: string, done: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setMsg(done);
    } catch {
      setMsg("Couldn’t copy. Press and hold the code to copy it.");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Sidelnr", text });
        return;
      } catch {
        return; // cancelled
      }
    }
    await copy(text, "Invitation copied. Paste it into a message.");
  };
  return (
    <div className="space-y-3 rounded-xl bg-zinc-50 p-3">
      <p className="text-center font-mono text-2xl font-bold tracking-widest select-all">{code}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => copy(code, "Code copied.")} className="rounded-xl border border-zinc-300 bg-white px-3 py-2 font-medium">
          Copy code
        </button>
        <button type="button" onClick={share} className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white">
          Share invitation
        </button>
      </div>
      <p className="text-xs text-zinc-500">{note} Works once, within 24 hours.</p>
      <button type="button" onClick={again} className="text-xs text-zinc-600 underline">
        Make another code
      </button>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}

const link = (c: string) => `${window.location.origin}/me?join=${c}`;

/** Join our family: the other phone sees everything in My Activities. */
export function ShareFamily() {
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 p-3">
      <h3 className="font-semibold">Join our family</h3>
      <p className="text-xs text-zinc-500">
        Their phone becomes part of your family: they see <b className="font-semibold text-zinc-700">every event</b> in My Activities, now and
        later, and can add things and sort out clashes too. For the other parent, or a grandparent who helps every week.
      </p>
      {code ? (
        <CodeBox
          code={code}
          text={`Join our family on Sidelnr to see all our activities: ${link(code)}\n\nOr open Sidelnr, go to My Activities, tap Share and enter the code ${code}. It works once, within 24 hours.`}
          note="Their phone joins your family and sees everything."
          again={() => setCode(null)}
        />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await shareActivities(null);
              if ("error" in res) return setMsg(res.error ?? null);
              setCode(res.code);
            })
          }
          className="w-full rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
        >
          Get a family code
        </button>
      )}
      {msg && <p className="text-xs text-accent">{msg}</p>}
    </section>
  );
}

/** Share one event: every time, or one date. They don't join the family. */
export function ShareEvent({ events }: { events: Shareable[] }) {
  const [id, setId] = useState(events[0]?.id ?? "");
  const [when, setWhen] = useState<"all" | string>("all");
  const [code, setCode] = useState<{ code: string; text: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ev = events.find((e) => e.id === id);
  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 p-3">
      <h3 className="font-semibold">Share one event</h3>
      <p className="text-xs text-zinc-500">
        Only this event, <b className="font-semibold text-zinc-700">not your family</b>. It shows as a Shared event in their own My Activities, next
        to their family’s things. They can leave it any time. For someone who helps with one thing, like an aunt who takes them to soccer.
      </p>
      {!events.length ? (
        <p className="text-xs text-zinc-500">Add an activity first, then you can share it.</p>
      ) : code ? (
        <CodeBox code={code.code} text={code.text} note="They get this event only, not your family." again={() => setCode(null)} />
      ) : (
        <>
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setWhen("all");
            }}
            aria-label="Event"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          {ev && ev.dates.length > 1 && (
            <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When" className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base">
              <option value="all">Every time</option>
              {ev.dates.map((d) => (
                <option key={d.iso} value={d.iso}>
                  Only {d.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={pending || !ev}
            onClick={() =>
              start(async () => {
                if (!ev) return;
                const only = when === "all" ? (ev.dates.length === 1 ? ev.dates[0].iso : null) : when;
                const res = await shareEvent(ev.id, only);
                if ("error" in res) return setMsg(res.error ?? null);
                setMsg(null);
                const date = only ? ev.dates.find((d) => d.iso === only)?.label : null;
                setCode({
                  code: res.code,
                  text: `I’ve shared ${ev.name}${date ? ` (${date})` : ""} with you on Sidelnr. It’s just this event: it shows as a Shared event in your My Activities. Tap to add it: ${link(res.code)}\n\nOr open Sidelnr, go to My Activities, tap Share and enter the code ${res.code}. It works once, within 24 hours.`,
                });
              })
            }
            className="w-full rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30"
          >
            Get a code for this event
          </button>
        </>
      )}
      {msg && <p className="text-xs text-accent">{msg}</p>}
    </section>
  );
}

// Entering a code from another phone. `initial` comes from an invitation link
// (/me?join=…); nothing is used up until "Add" is tapped.
export function JoinCode({ initial = "", highlight = false }: { initial?: string; highlight?: boolean }) {
  const format = (v: string) => {
    const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  };
  const router = useRouter();
  const [entered, setEntered] = useState(format(initial));
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const ready = entered.replace("-", "").length === 8;
  return (
    <div className={`space-y-2 text-sm ${highlight ? "rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-sm" : ""}`}>
      <span className="block font-medium">{highlight ? "Someone shared with you" : "Got a code?"}</span>
      {highlight && <span className="block text-xs text-zinc-500">Tap Add: the code says if it’s one event or joining their family.</span>}
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
              // The code is used up: take it out of the address (an invitation link), so it isn't offered again.
              if (!("error" in res) && initial) router.replace("/me", { scroll: false });
              setMsg(
                "error" in res
                  ? { error: res.error }
                  : {
                      ok:
                        res.kind === "event"
                          ? "Added to your My Activities as a Shared event. You haven’t joined their family."
                          : "You’ve joined the family: this phone now sees all its activities.",
                    },
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
