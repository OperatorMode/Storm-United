"use client";

import { useOptimistic, useState, useTransition } from "react";
import { markAttendance } from "@/app/actions";
import type { AttendanceStatus } from "@/lib/store";

const OPTIONS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: "yes", label: "Can play", on: "bg-emerald-600 text-white border-emerald-600" },
  { value: "maybe", label: "Maybe", on: "bg-amber-500 text-white border-amber-500" },
  { value: "no", label: "Can't make it", on: "bg-zinc-900 text-white border-zinc-900" },
];

export function AttendanceButtons({ gameId, status }: { gameId: string; status: AttendanceStatus | null }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
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
                setOptimistic(o.value);
                const res = await markAttendance(gameId, o.value);
                setError(res.error ?? null);
              })
            }
            className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
              optimistic === o.value ? o.on : "border-zinc-300 bg-white text-zinc-700 active:bg-zinc-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}
