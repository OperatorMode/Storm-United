"use client";

import { useState, useTransition } from "react";
import { setGameGoalies } from "./actions";

export function GoalieAssign({
  teamId,
  gameId,
  players,
  first,
  second,
}: {
  teamId: string;
  gameId: string;
  players: { id: string; name: string; out: boolean }[];
  first: string | null;
  second: string | null;
}) {
  const [one, setOne] = useState(first ?? "");
  const [two, setTwo] = useState(second ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = one !== (first ?? "") || two !== (second ?? "");

  const select = (label: string, value: string, set: (v: string) => void) => (
    <label className="min-w-0 flex-1">
      <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          set(e.target.value);
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
  );

  return (
    <div className="flex items-end gap-2">
      {select("1st half", one, setOne)}
      {select("2nd half", two, setTwo)}
      <button
        type="button"
        disabled={pending || !dirty}
        onClick={() =>
          start(async () => {
            const res = await setGameGoalies(teamId, gameId, one || null, two || null);
            setMsg(res.error ?? "Saved");
          })
        }
        className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
      >
        {msg === "Saved" && !dirty ? "✓" : "Save"}
      </button>
      {msg && msg !== "Saved" && <span className="text-xs text-accent">{msg}</span>}
    </div>
  );
}
