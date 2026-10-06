"use client";

import { useOptimistic, useState, useTransition } from "react";
import { updateTrainingAttendance } from "@/app/[team]/actions";
import type { AttendanceStatus } from "@/lib/store";

const OPTIONS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: "yes", label: "Coming", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "maybe", label: "Maybe", on: "bg-amber-500 text-white border-amber-500" },
  { value: "no", label: "Can’t come", on: "bg-zinc-900 text-white border-zinc-900" },
];

// One child's answer for a training session.
export function TrainingButtons({
  teamId,
  sessionId,
  playerId,
  status,
}: {
  teamId: string;
  sessionId: string;
  playerId: string;
  status: AttendanceStatus | null;
}) {
  const [current, setCurrent] = useOptimistic(status);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              start(async () => {
                setCurrent(o.value);
                const res = await updateTrainingAttendance(teamId, sessionId, o.value, playerId);
                setError(res.error ?? null);
              })
            }
            className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${current === o.value ? o.on : "border-zinc-300 bg-white text-zinc-700"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
