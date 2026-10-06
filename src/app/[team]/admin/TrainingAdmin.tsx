"use client";

import { useActionState, useState, useTransition } from "react";
import { createTraining, removeTraining, setTrainingOff } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "mb-1 block text-sm font-medium";
const DAYS = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [0, "Sunday"],
] as const;

type Session = {
  id: string;
  when: string; // "Tue, 7 Oct, 5:00 pm"
  minutes: number;
  location: string | null;
  cancelled: boolean;
  series: boolean;
  coming: number;
  maybe: number;
  out: number;
};

// Manager's Corner: weekly training on one or more days, extra sessions, cancel a week, see who's coming.
export function TrainingAdmin({ teamId, sessions, squad }: { teamId: string; sessions: Session[]; squad: number }) {
  const [state, action, pending] = useActionState(createTraining.bind(null, teamId), null);
  const [weekly, setWeekly] = useState(true);
  const [slots, setSlots] = useState([{ key: 0, day: 2, time: "17:00", location: "" }]);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-4 text-sm">
      {sessions.length > 0 ? (
        <ul className="divide-y divide-zinc-100">
          {sessions.map((s) => (
            <li key={s.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`font-medium ${s.cancelled ? "text-zinc-400 line-through" : ""}`}>{s.when}</div>
                  <div className="text-xs text-zinc-500">
                    {s.minutes} min{s.location ? ` · ${s.location}` : ""}
                    {!s.cancelled && ` · ${s.coming}/${squad} coming${s.maybe ? `, ${s.maybe} maybe` : ""}${s.out ? `, ${s.out} out` : ""}`}
                  </div>
                </div>
                {s.cancelled && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Cancelled</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    (s.cancelled || confirm("Cancel this session? Everyone with game alerts on gets told.")) && start(() => setTrainingOff(teamId, s.id, !s.cancelled).then(() => {}))
                  }
                  className="underline"
                >
                  {s.cancelled ? "Put back on" : "Cancel (e.g. rain)"}
                </button>
                <button type="button" disabled={busy} onClick={() => confirm("Delete this session?") && start(() => removeTraining(teamId, s.id, false).then(() => {}))} className="text-zinc-500 underline">
                  Delete
                </button>
                {s.series && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirm("Delete this and every later weekly session?") && start(() => removeTraining(teamId, s.id, true).then(() => {}))}
                    className="text-zinc-500 underline"
                  >
                    Delete this and later weeks
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-500">No training scheduled yet.</p>
      )}

      <details className="rounded-xl bg-zinc-50 p-3" open={sessions.length === 0}>
        <summary className="cursor-pointer font-medium">+ Add training</summary>
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="mode" value={weekly ? "weekly" : "extra"} />
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1">
            {[
              [true, "Weekly training"],
              [false, "Extra session"],
            ].map(([w, text]) => (
              <button
                key={String(w)}
                type="button"
                onClick={() => setWeekly(w as boolean)}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${weekly === w ? "bg-zinc-900 text-white" : "text-zinc-500"}`}
              >
                {text as string}
              </button>
            ))}
          </div>

          {weekly ? (
            <>
              <div className="space-y-2">
                {slots.map((slot, i) => (
                  <div key={slot.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <label className="block">
                      <span className={label}>Day</span>
                      <select name="slot_day" defaultValue={slot.day} className={field}>
                        {DAYS.map(([d, n]) => (
                          <option key={d} value={d}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={label}>Start</span>
                      <input name="slot_time" type="time" defaultValue={slot.time} className={field} required />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSlots(slots.filter((x) => x.key !== slot.key))}
                      disabled={slots.length === 1}
                      className="pb-2.5 text-xs text-zinc-500 underline disabled:opacity-0"
                    >
                      Remove
                    </button>
                    <input name="slot_location" placeholder="Where (e.g. Piara Waters oval)" defaultValue={slot.location} className={`${field} col-span-3`} />
                    {i < slots.length - 1 && <div className="col-span-3 border-t border-zinc-200" />}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSlots([...slots, { key: Date.now(), day: 4, time: "17:00", location: slots.at(-1)?.location ?? "" }])}
                  className="text-xs font-medium text-zinc-700 underline"
                >
                  + Add another day
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={label}>From</span>
                  <input name="from" type="date" className={field} required />
                </label>
                <label className="block">
                  <span className={label}>Until</span>
                  <input name="until" type="date" className={field} required />
                </label>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Date</span>
                <input name="date" type="date" className={field} required />
              </label>
              <label className="block">
                <span className={label}>Start</span>
                <input name="time" type="time" defaultValue="17:00" className={field} required />
              </label>
              <input name="location" placeholder="Where" className={`${field} col-span-2`} />
            </div>
          )}

          <label className="block">
            <span className={label}>Minutes</span>
            <input name="minutes" type="number" min={15} max={300} defaultValue={60} className={field} />
          </label>
          <input name="note" placeholder="Note (optional), e.g. bring water and shin pads" className={field} />
          <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
            {pending ? "Adding…" : weekly ? "Add weekly training" : "Add extra session"}
          </button>
          {state?.error && <p className="text-accent">{state.error}</p>}
          {state?.ok && <p className="text-emerald-700">{state.count === 1 ? "Session added." : `${state.count} sessions added.`}</p>}
        </form>
      </details>
    </div>
  );
}
