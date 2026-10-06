"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateAttendance } from "@/app/[team]/actions";
import type { AttendanceStatus, GoalieHalf } from "@/lib/store";

const OPTIONS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: "yes", label: "Can play", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "maybe", label: "Maybe", on: "bg-amber-500 text-white border-amber-500" },
  { value: "no", label: "Can't make it", on: "bg-zinc-900 text-white border-zinc-900" },
];

const GOALIE_OPTIONS: { value: GoalieHalf; label: string }[] = [
  { value: "1st", label: "1st Half" },
  { value: "2nd", label: "2nd Half" },
  { value: "full", label: "Full Game" },
];

type State = { status: AttendanceStatus | null; goalie: GoalieHalf | null };

export function AttendanceButtons({
  teamId,
  gameId,
  status,
  goalie,
  goalieEnabled,
  playerId,
}: {
  teamId: string;
  playerId: string;
  gameId: string;
  goalieEnabled: boolean;
  status: AttendanceStatus | null;
  goalie: GoalieHalf | null;
}) {
  // Mirrors the server rules so the UI updates instantly: volunteering for
  // goal means "Can play", and "Can't make it" clears the goalie slot.
  const [state, setOptimistic] = useOptimistic<State, Partial<State>>({ status, goalie }, (s, change) =>
    "goalie" in change
      ? { status: change.goalie ? "yes" : s.status, goalie: change.goalie ?? null }
      : { status: change.status ?? s.status, goalie: change.status === "no" ? null : s.goalie },
  );
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function save(change: { status: AttendanceStatus } | { goalie: GoalieHalf | null }) {
    start(async () => {
      setOptimistic(change);
      const res = await updateAttendance(teamId, gameId, change, playerId);
      setError(res.error ?? null);
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => save({ status: o.value })}
            className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
              state.status === o.value ? o.on : "border-zinc-300 bg-white text-zinc-700 active:bg-zinc-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {goalieEnabled && state.status !== "no" && (
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-xs font-medium text-zinc-500">Happy to be goalie</legend>
          <div className="grid grid-cols-3 gap-2">
            {GOALIE_OPTIONS.map((o) => {
              const checked = state.goalie === o.value;
              return (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition ${
                    checked ? "border-zinc-900 bg-zinc-50 font-medium" : "border-zinc-300 bg-white text-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => save({ goalie: checked ? null : o.value })}
                    className="size-4 accent-zinc-900"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
