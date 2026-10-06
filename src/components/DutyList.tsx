"use client";

import { useState, useTransition } from "react";
import { volunteerForDuty } from "@/app/[team]/actions";

export type DutySlot = { duty: string; takenBy: string | null; mine: boolean };

// The jobs for one game: who's on each, and "I'll do it" for the open ones.
export function DutyList({ teamId, gameId, slots, canTake }: { teamId: string; gameId: string; slots: DutySlot[]; canTake: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (duty: string, take: boolean) =>
    start(async () => {
      const res = await volunteerForDuty(teamId, gameId, duty, take);
      setError(res.error ?? null);
    });
  return (
    <div>
      <ul className="divide-y divide-zinc-100 text-sm">
        {slots.map((s) => (
          <li key={s.duty} className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium">{s.duty}</span>
            {s.mine ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">You</span>
                <button type="button" disabled={pending} onClick={() => act(s.duty, false)} className="text-zinc-500 underline">
                  Undo
                </button>
              </span>
            ) : s.takenBy ? (
              <span className="text-xs text-zinc-500">{s.takenBy}</span>
            ) : canTake ? (
              <button type="button" disabled={pending} onClick={() => act(s.duty, true)} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                I’ll do it
              </button>
            ) : (
              <span className="text-xs text-amber-700">Open</span>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
