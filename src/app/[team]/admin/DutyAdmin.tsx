"use client";

import { useActionState, useState, useTransition } from "react";
import { assignDuty, saveDutyList } from "./actions";

type GameDuties = { gameId: string; label: string; slots: { duty: string; playerId: string | null }[] };

// Manager's Corner: which jobs the team needs each game, and who's on them.
export function DutyAdmin({
  teamId,
  duties,
  suggestions,
  games,
  families,
}: {
  teamId: string;
  duties: string[];
  suggestions: string[];
  games: GameDuties[];
  families: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveDutyList.bind(null, teamId), null);
  const [text, setText] = useState(duties.join("\n"));
  const [busy, start] = useTransition();
  const missing = suggestions.filter((s) => !text.split("\n").map((l) => l.trim().toLowerCase()).includes(s.toLowerCase()));

  return (
    <div className="space-y-4 text-sm">
      {duties.length > 0 && games.length > 0 && (
        <div className="space-y-3">
          {games.map((g) => (
            <div key={g.gameId} className="rounded-xl bg-zinc-50 p-3">
              <div className="mb-1.5 text-xs font-semibold text-zinc-600">{g.label}</div>
              <div className="space-y-1.5">
                {g.slots.map((s) => (
                  <label key={s.duty} className="flex items-center justify-between gap-2">
                    <span>{s.duty}</span>
                    <select
                      value={s.playerId ?? ""}
                      disabled={busy}
                      onChange={(e) => start(() => assignDuty(teamId, g.gameId, s.duty, e.target.value).then(() => {}))}
                      className="max-w-44 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="">Open</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-xl border border-zinc-200 p-3" open={duties.length === 0}>
        <summary className="cursor-pointer font-medium">{duties.length ? "Change the duties" : "Set up duties"}</summary>
        <form action={action} className="mt-3 space-y-2">
          <p className="text-xs text-zinc-500">One per line. Parents see them under each game and tap “I’ll do it”.</p>
          <textarea name="duties" value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base" />
          {missing.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {missing.map((m) => (
                <button key={m} type="button" onClick={() => setText((t) => (t.trim() ? `${t.trim()}\n${m}` : m))} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs">
                  + {m}
                </button>
              ))}
            </div>
          )}
          <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
            {pending ? "Saving…" : "Save duties"}
          </button>
          {state?.error && <p className="text-accent">{state.error}</p>}
          {state?.ok && <p className="text-emerald-700">Saved.</p>}
        </form>
      </details>
    </div>
  );
}
