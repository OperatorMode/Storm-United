"use client";

import { useState } from "react";
import { PART_PRESETS } from "@/lib/role";

// How the team's games are split: halves, quarters, periods, innings, sets.
// Role sign-ups (goalie, catcher...) and the rotation follow it.
export function PartsField({ count, name }: { count: number; name: string }) {
  const known = PART_PRESETS.find((p) => p.name === name) ?? PART_PRESETS[0];
  const [preset, setPreset] = useState(known.name);
  const [n, setN] = useState(count);
  const chosen = PART_PRESETS.find((p) => p.name === preset) ?? PART_PRESETS[0];
  const parts = chosen.count ?? n;
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block font-medium">Game is played in</span>
        <select
          value={preset}
          onChange={(e) => {
            const next = PART_PRESETS.find((p) => p.name === e.target.value)!;
            setPreset(next.name);
            if (!next.count) setN(next.name === "Inning" ? 6 : 3); // a starting point; change below
          }}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base"
        >
          {PART_PRESETS.map((p) => (
            <option key={p.name} value={p.name}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {!chosen.count && (
        <label className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={12}
            value={n}
            onChange={(e) => setN(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            className="w-20 rounded-xl border border-zinc-300 px-3 py-2 text-base"
          />
          <span className="text-zinc-600">{chosen.name === "Inning" ? "innings" : "sets"} per game</span>
        </label>
      )}
      <input type="hidden" name="game_parts" value={parts} />
      <input type="hidden" name="part_name" value={chosen.name} />
    </div>
  );
}
