"use client";

import { useState, useTransition } from "react";
import { setGameGoalies } from "./actions";

// The coach picks who has the special role (goalie, catcher...) in each part
// of one game: halves, quarters, innings.
export function GoalieAssign({
  teamId,
  gameId,
  players,
  assigned,
  partNames,
}: {
  teamId: string;
  gameId: string;
  players: { id: string; name: string; out: boolean }[];
  assigned: (string | null)[]; // one per part
  partNames: string[]; // e.g. "1st half", "Q2", "Inning 3"
}) {
  const [picks, setPicks] = useState(assigned.map((a) => a ?? ""));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = picks.some((p, i) => p !== (assigned[i] ?? ""));

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${partNames.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {partNames.map((label, i) => (
          <label key={label} className="min-w-0">
            <span className="mb-0.5 block truncate text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
            <select
              value={picks[i]}
              onChange={(e) => {
                setPicks(picks.map((p, j) => (j === i ? e.target.value : p)));
                setMsg(null);
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">-</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.out ? " (out)" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const res = await setGameGoalies(teamId, gameId, picks.map((p) => p || null));
              setMsg(res.error ?? "Saved");
            })
          }
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
        >
          {msg === "Saved" && !dirty ? "Saved" : "Save"}
        </button>
        {msg && msg !== "Saved" && <span className="text-xs text-accent">{msg}</span>}
      </div>
    </div>
  );
}
