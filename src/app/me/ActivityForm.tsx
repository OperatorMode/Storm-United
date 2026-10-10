"use client";

import { useState, useTransition } from "react";
import { addActivity } from "./activity-actions";

const DAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];
const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

// Adding a family activity: who it's for (a child, me, or someone new), what
// it is, and when: every week (like training), just once, or imported from a
// calendar or web page that has the dates.
export function ActivityForm({ people }: { people: string[] }) {
  const [person, setPerson] = useState(people[0] ?? "Me");
  const [other, setOther] = useState(false);
  const [mode, setMode] = useState<"weekly" | "once" | "import">("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  const [key, setKey] = useState(0); // a fresh, empty form after each one added
  const today = new Date().toLocaleDateString("en-CA");
  const choices = [...new Set([...people, "Me"])];

  return (
    <form
      key={key}
      onSubmit={(e) => {
        e.preventDefault();
        const el = e.currentTarget;
        const form = new FormData(el);
        form.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
        start(async () => {
          const res = await addActivity(null, form);
          if ("error" in res) return setMsg({ error: res.error });
          setMsg({ ok: mode === "import" ? `Added, with ${res.count} session${res.count === 1 ? "" : "s"} from the link.` : "Added." });
          setDays([]);
          setKey((k) => k + 1);
          // Fold the form away again: the new activity shows in the list above.
          const box = el.closest("details");
          if (box) box.open = false;
        });
      }}
      className="space-y-4 text-sm"
    >
      <div>
        <span className="mb-1 block font-medium">Who’s it for?</span>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPerson(p);
                setOther(false);
              }}
              className={`rounded-full border px-3 py-1.5 ${!other && person === p ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOther(true);
              setPerson("");
            }}
            className={`rounded-full border px-3 py-1.5 ${other ? "border-zinc-900 bg-zinc-900 text-white" : "border-dashed border-zinc-400 bg-white"}`}
          >
            + Someone else
          </button>
        </div>
        {other ? (
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="First name"
            maxLength={40}
            className={`${field} mt-2`}
            autoFocus
          />
        ) : null}
        <input type="hidden" name="person" value={person} />
      </div>

      <label className="block">
        <span className="mb-1 block font-medium">Activity</span>
        <input name="name" required maxLength={60} placeholder="e.g. Piano, Ballet, Swimming" className={field} />
      </label>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
        {(
          [
            ["weekly", "Every week"],
            ["once", "Just once"],
            ["import", "From a link"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-2 py-1.5 font-medium ${mode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="mode" value={mode} />

      {mode === "import" ? (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block font-medium">Calendar or web page link</span>
            <span className="mb-1.5 block text-xs text-zinc-500">
              A calendar link (Google Calendar, iCal or webcal), or a page with the dates on it, like a term timetable.
            </span>
            <input name="url" required inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://…" className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block font-medium">Only sessions with these words (optional)</span>
            <input name="filter" maxLength={60} placeholder="e.g. Junior Ballet, Year 4" className={field} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === "weekly" ? (
            <div>
              <span className="mb-1 block font-medium">On</span>
              <div className="grid grid-cols-7 gap-1">
                {DAYS.map(([d, label]) => (
                  <label
                    key={d}
                    className={`cursor-pointer rounded-lg border py-1.5 text-center text-xs font-medium ${days.includes(d) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`}
                  >
                    <input
                      type="checkbox"
                      name="days"
                      value={d}
                      checked={days.includes(d)}
                      onChange={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="mb-1 block font-medium">Date</span>
              <input name="date" type="date" required defaultValue={today} className={field} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block font-medium">Starts</span>
              <input name="time" type="time" required defaultValue="16:00" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Minutes</span>
              <input name="minutes" type="number" min={5} max={1440} required defaultValue={60} className={field} />
            </label>
          </div>
          {mode === "weekly" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block font-medium">From</span>
                <input name="starts_on" type="date" required defaultValue={today} className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Until (optional)</span>
                <input name="ends_on" type="date" className={field} />
              </label>
            </div>
          )}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block font-medium">Where (optional)</span>
        <input name="location" maxLength={120} placeholder="Address, for directions" className={field} />
      </label>

      <button disabled={pending || !person.trim()} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30">
        {pending ? (mode === "import" ? "Reading the link…" : "Adding…") : "Add activity"}
      </button>
      {msg?.error && <p className="text-accent">{msg.error}</p>}
      {msg?.ok && <p className="text-emerald-700">{msg.ok}</p>}
    </form>
  );
}
