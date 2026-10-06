"use client";

import { useActionState, useState, useTransition } from "react";
import { createTraining, removeTraining, setTrainingOff } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "mb-1 block text-sm font-medium";

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

// Manager's Corner: add training (one-off or weekly), cancel a week, see who's coming.
export function TrainingAdmin({ teamId, sessions, squad }: { teamId: string; sessions: Session[]; squad: number }) {
  const [state, action, pending] = useActionState(createTraining.bind(null, teamId), null);
  const [weekly, setWeekly] = useState(true);
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
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>{weekly ? "First session" : "Date"}</span>
              <input name="date" type="date" className={field} required />
            </label>
            <label className="block">
              <span className={label}>Start</span>
              <input name="time" type="time" defaultValue="17:00" className={field} required />
            </label>
            <label className="block">
              <span className={label}>Minutes</span>
              <input name="minutes" type="number" min={15} max={300} defaultValue={60} className={field} />
            </label>
            <label className="block">
              <span className={label}>Where</span>
              <input name="location" placeholder="e.g. Piara Waters oval" className={field} />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="repeat" value="weekly" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} />
            Every week
          </label>
          {weekly && (
            <label className="block">
              <span className={label}>Until</span>
              <input name="until" type="date" className={field} required />
            </label>
          )}
          <input name="note" placeholder="Note (optional), e.g. bring water and shin pads" className={field} />
          <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
            {pending ? "Adding…" : "Add training"}
          </button>
          {state?.error && <p className="text-accent">{state.error}</p>}
          {state?.ok && <p className="text-emerald-700">{state.count === 1 ? "Session added." : `${state.count} weekly sessions added.`}</p>}
        </form>
      </details>
    </div>
  );
}
