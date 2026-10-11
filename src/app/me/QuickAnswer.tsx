"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AttendanceStatus } from "@/lib/store";
import { updateAttendance, updateTrainingAttendance } from "@/app/[team]/actions";

const OPTIONS: { status: AttendanceStatus; label: string; on: string }[] = [
  { status: "yes", label: "Can play", on: "bg-emerald-600 text-white border-emerald-600" },
  { status: "maybe", label: "Maybe", on: "bg-amber-500 text-white border-amber-500" },
  { status: "no", label: "Can’t make it", on: "bg-zinc-800 text-white border-zinc-800" },
];

// Answer "can … play?" right on My Activities, without going to the team page.
export function QuickAnswer({
  teamId,
  gameId,
  kidId,
  kidName,
  training,
  status,
  showName,
}: {
  teamId: string;
  gameId: string;
  kidId: string;
  kidName: string;
  training: boolean;
  status: AttendanceStatus | null;
  showName: boolean; // several children on one card
}) {
  const router = useRouter();
  const [now, setNow] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answer = (s: AttendanceStatus) =>
    start(async () => {
      setError(null);
      const res = training ? await updateTrainingAttendance(teamId, gameId, s, kidId) : await updateAttendance(teamId, gameId, { status: s }, kidId);
      if (res && "error" in res && res.error) return setError(res.error);
      setNow(s);
      router.refresh();
    });
  return (
    <div className="w-full">
      <span className="mb-1 block text-xs text-zinc-500">
        {showName ? `${kidName}: ` : ""}
        {now ? "Your answer" : `Can ${kidName} ${training ? "come" : "play"}?`}
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.status}
            type="button"
            disabled={pending}
            onClick={() => answer(o.status)}
            aria-pressed={now === o.status}
            className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${now === o.status ? o.on : "border-zinc-300 bg-white text-zinc-700"}`}
          >
            {training && o.status === "yes" ? "Coming" : o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
