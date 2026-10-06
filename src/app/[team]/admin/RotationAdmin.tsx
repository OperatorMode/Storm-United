"use client";

import { useMemo, useState, useTransition } from "react";
import { saveGameRotation } from "./actions";
import { buildRotation, periodsInHalf, seasonTotals, type RotationPlan, type Spot } from "@/lib/rotation-plan";

type GameInfo = {
  id: string;
  label: string;
  available: string[]; // everyone who hasn't said they can't make it
  goalies: { first: string | null; second: string | null };
  saved: RotationPlan | null;
};

const PERIODS = [
  [2, "Halves", "H"],
  [3, "Thirds", "T"],
  [4, "Quarters", "Q"],
] as const;
const NEXT: Record<Spot, Spot> = { on: "rest", rest: "gk", gk: "on" };
const CELL: Record<Spot, string> = {
  on: "bg-emerald-600 text-white",
  rest: "bg-zinc-200 text-zinc-600",
  gk: "bg-amber-400 text-zinc-900",
};
const CELL_LABEL: Record<Spot, string> = { on: "On", rest: "Rest", gk: "GK" };

// Manager's Corner: a fair rotation for a game, who's on and who rests each
// period, balanced over the whole season. Tap a cell to change it.
export function RotationAdmin({
  teamId,
  players,
  games,
  allSaved,
  defaults,
}: {
  teamId: string;
  players: { id: string; name: string }[];
  games: GameInfo[];
  allSaved: Record<string, RotationPlan>;
  defaults: { periods: number; onField: number };
}) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const game = games.find((g) => g.id === gameId);
  const [periods, setPeriods] = useState(game?.saved?.periods ?? defaults.periods);
  const [onField, setOnField] = useState(game?.saved?.onField ?? defaults.onField);
  const [available, setAvailable] = useState<string[]>(game?.saved ? Object.keys(game.saved.spots) : (game?.available ?? []));
  const [plan, setPlan] = useState<RotationPlan | null>(game?.saved ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const name = (id: string) => players.find((p) => p.id === id)?.name.split(" ")[0] ?? id;
  // Rests so far this season, not counting this game's own saved plan.
  const restsSoFar = useMemo(() => {
    const totals = seasonTotals(Object.entries(allSaved).filter(([id]) => id !== gameId).map(([, p]) => p));
    return Object.fromEntries(Object.entries(totals).map(([id, t]) => [id, t.rested]));
  }, [allSaved, gameId]);
  const season = useMemo(() => seasonTotals(Object.values(allSaved)), [allSaved]);

  const pickGame = (id: string) => {
    const g = games.find((x) => x.id === id);
    setGameId(id);
    setPlan(g?.saved ?? null);
    setAvailable(g?.saved ? Object.keys(g.saved.spots) : (g?.available ?? []));
    if (g?.saved) {
      setPeriods(g.saved.periods);
      setOnField(g.saved.onField);
    }
    setMsg(null);
  };

  const make = () => {
    if (!game) return;
    const goalies = Array.from({ length: periods }, (_, i) =>
      periodsInHalf(periods, "1st").includes(i) ? game.goalies.first : game.goalies.second,
    );
    const ordered = players.map((p) => p.id).filter((id) => available.includes(id));
    setPlan(buildRotation({ players: ordered, periods, onField, goalies, restsSoFar }));
    setMsg(null);
  };

  const cycle = (player: string, i: number) =>
    setPlan((p) => (p ? { ...p, spots: { ...p.spots, [player]: p.spots[player].map((s, j) => (j === i ? NEXT[s] : s)) } } : p));

  if (!games.length) return <p className="text-sm text-zinc-500">No upcoming games to plan.</p>;
  const tag = PERIODS.find(([n]) => n === (plan?.periods ?? periods))?.[2] ?? "P";

  return (
    <div className="space-y-4 text-sm">
      <select value={gameId} onChange={(e) => pickGame(e.target.value)} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base">
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
            {g.saved ? " (planned)" : ""}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block font-medium">Played in</span>
          <select value={periods} onChange={(e) => setPeriods(Number(e.target.value))} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base">
            {PERIODS.map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">On the field</span>
          <input type="number" min={1} max={30} value={onField} onChange={(e) => setOnField(Number(e.target.value))} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base" />
          <span className="mt-0.5 block text-xs text-zinc-400">Including the goalie</span>
        </label>
      </div>

      <div>
        <span className="mb-1 block font-medium">Who’s there ({available.length})</span>
        <div className="flex flex-wrap gap-1.5">
          {players.map((p) => {
            const on = available.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAvailable(on ? available.filter((x) => x !== p.id) : [...available, p.id])}
                className={`rounded-full px-3 py-1 text-xs ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 line-through"}`}
              >
                {name(p.id)}
              </button>
            );
          })}
        </div>
        <span className="mt-1 block text-xs text-zinc-400">Everyone except those marked Can’t make it. Goalies come from Assign goalies.</span>
      </div>

      <button type="button" onClick={make} disabled={available.length === 0} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-30">
        {plan ? "Make a new rotation" : "Make rotation"}
      </button>

      {plan && (
        <div className="space-y-2">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500">
                  <th className="px-1 py-1 text-left font-medium">Player</th>
                  {Array.from({ length: plan.periods }, (_, i) => (
                    <th key={i} className="px-1 py-1 font-medium">
                      {tag}
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(plan.spots).map((p) => (
                  <tr key={p}>
                    <td className="max-w-24 truncate px-1 py-0.5 font-medium">{name(p)}</td>
                    {plan.spots[p].map((s, i) => (
                      <td key={i} className="px-0.5 py-0.5">
                        <button type="button" onClick={() => cycle(p, i)} className={`w-full rounded-md py-1.5 font-semibold ${CELL[s]}`}>
                          {CELL_LABEL[s]}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="text-zinc-500">
                  <td className="px-1 pt-1">On field</td>
                  {Array.from({ length: plan.periods }, (_, i) => {
                    const n = Object.values(plan.spots).filter((l) => l[i] !== "rest").length;
                    return (
                      <td key={i} className={`px-1 pt-1 text-center font-semibold ${n === plan.onField ? "" : "text-red-600"}`}>
                        {n}/{plan.onField}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400">Tap a cell to switch On, Rest or GK.</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveGameRotation(teamId, gameId, plan);
                  setMsg(res.error ?? "Saved. It counts towards the season balance.");
                })
              }
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"
            >
              {pending ? "Saving…" : "Save rotation"}
            </button>
            {game?.saved && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await saveGameRotation(teamId, gameId, null);
                    setPlan(null);
                    setMsg("Cleared.");
                  })
                }
                className="rounded-xl border border-zinc-300 px-4 py-2.5"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}

      {Object.keys(season).length > 0 && (
        <details className="rounded-xl bg-zinc-50 p-3">
          <summary className="cursor-pointer font-medium">Season balance</summary>
          <table className="mt-2 w-full text-xs tabular-nums">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="py-1 font-medium">Player</th>
                <th className="py-1 text-center font-medium">Played</th>
                <th className="py-1 text-center font-medium">Rested</th>
                <th className="py-1 text-right font-medium">Time on</th>
              </tr>
            </thead>
            <tbody>
              {players
                .filter((p) => season[p.id])
                .map((p) => {
                  const t = season[p.id];
                  return (
                    <tr key={p.id} className="border-t border-zinc-200">
                      <td className="py-1">{name(p.id)}</td>
                      <td className="py-1 text-center">{t.played}</td>
                      <td className="py-1 text-center">{t.rested}</td>
                      <td className="py-1 text-right">{Math.round((t.played / (t.played + t.rested || 1)) * 100)}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
