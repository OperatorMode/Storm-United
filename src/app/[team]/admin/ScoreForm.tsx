"use client";

import { useState, useTransition } from "react";
import { saveManualScore } from "./actions";

export function ScoreForm({
  teamId,
  gameId,
  home,
  away,
  initial,
}: {
  teamId: string;
  gameId: string;
  home: string;
  away: string;
  initial: { home: number; away: number } | null;
}) {
  const [h, setH] = useState(initial ? String(initial.home) : "");
  const [a, setA] = useState(initial ? String(initial.away) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = "w-12 rounded-lg border border-zinc-300 px-2 py-1.5 text-center text-base tabular-nums";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-right">{home}</span>
      <input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" className={input} aria-label={`${home} goals`} />
      <input value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" className={input} aria-label={`${away} goals`} />
      <span className="min-w-0 flex-1 truncate">{away}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveManualScore(teamId, gameId, h.trim(), a.trim());
            setMsg(res.error ?? "Saved");
          })
        }
        className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white"
      >
        {msg === "Saved" && !pending ? "✓" : "Save"}
      </button>
      {msg && msg !== "Saved" && <span className="text-xs text-accent">{msg}</span>}
    </div>
  );
}
