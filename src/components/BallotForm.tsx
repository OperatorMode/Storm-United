"use client";

import { useState, useTransition } from "react";
import { submitBallot } from "@/app/[team]/actions";

const POINTS = [3, 2, 1];

// Tap players in order: first tap = 3 points, second = 2, third = 1.
export function BallotForm({
  teamId,
  gameId,
  candidates,
  existing,
}: {
  teamId: string;
  gameId: string;
  candidates: { id: string; name: string }[];
  existing: string[] | null;
}) {
  const [picks, setPicks] = useState<string[]>(existing ?? []);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setMessage(null);
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));
  }

  return (
    <div>
      <p className="mb-3 text-sm text-zinc-500">
        Tap your top 3 in order — 1st gets 3 points, 2nd gets 2, 3rd gets 1.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {candidates.map((c) => {
          const rank = picks.indexOf(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                rank >= 0 ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white active:bg-zinc-100"
              }`}
            >
              <span className="truncate">{c.name}</span>
              {rank >= 0 && (
                <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-zinc-900">
                  {POINTS[rank]} pts
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={picks.length !== 3 || pending}
        onClick={() =>
          start(async () => {
            const res = await submitBallot(teamId, gameId, picks);
            setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Votes saved — thanks!" });
          })
        }
        className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent disabled:opacity-40"
      >
        {pending ? "Saving…" : existing ? "Update my votes" : "Submit votes"}
      </button>
      {message && (
        <p className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-accent"}`}>{message.text}</p>
      )}
    </div>
  );
}
