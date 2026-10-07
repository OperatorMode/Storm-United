"use client";

import { useMemo, useState, useTransition } from "react";
import { saveGameRotation } from "./actions";
import { partPlural, roleInText, rolePlural, type GameParts } from "@/lib/role";
import { blocksOf, buildRotation, seasonTotals, type GameShape, type RotationPlan, type Spot } from "@/lib/rotation-plan";

type GameInfo = {
  id: string;
  label: string;
  available: string[]; // everyone who hasn't said they can't make it
  goalies: (string | null)[]; // who has the special role in each of the team's game parts
  saved: RotationPlan | null;
};

const PARTS: [number, string][] = [
  [2, "Halves"],
  [4, "Quarters"],
  [3, "Thirds"],
  [1, "One period"],
];
const NEXT: Record<Spot, Spot> = { on: "rest", rest: "gk", gk: "on" };
const CELL: Record<Spot, string> = {
  on: "bg-emerald-600 text-white",
  rest: "bg-zinc-200 text-zinc-600",
  gk: "bg-amber-400 text-zinc-900",
};
const CELL_LABEL: Record<Spot, string> = { on: "On", rest: "Rest", gk: "GK" };
// The role's cell: "GK" for a goalie, otherwise the role's first letters ("Cat").
const roleCell = (role: string | null) => (!role || /^goal/i.test(role) ? "GK" : role.slice(0, 3));
const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

// Manager's Corner: a fair rotation for a game. The game is split into blocks
// (e.g. swap every 10 minutes); rests are shared over the whole season.
export function RotationAdmin({
  teamId,
  players,
  games,
  allSaved,
  defaults,
  role,
  gameParts,
}: {
  role: string | null; // the team's special role (goalie...), when it has one
  gameParts: GameParts; // how the team's games are split
  teamId: string;
  players: { id: string; name: string }[];
  games: GameInfo[];
  allSaved: Record<string, RotationPlan>;
  defaults: { shape: GameShape; onField: number; goaliesStayOn: boolean };
}) {
  const [saved, setSaved] = useState(allSaved);
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const game = games.find((g) => g.id === gameId);
  const initial = saved[gameId] ?? null;
  const [shape, setShape] = useState<GameShape>(initial?.shape ?? defaults.shape);
  const [onField, setOnField] = useState(initial?.onField ?? defaults.onField);
  const [goaliesStayOn, setGoaliesStayOn] = useState(initial?.goaliesStayOn ?? defaults.goaliesStayOn);
  const [available, setAvailable] = useState<string[]>(initial ? Object.keys(initial.spots) : (game?.available ?? []));
  const [plan, setPlan] = useState<RotationPlan | null>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const name = (id: string) => players.find((p) => p.id === id)?.name.split(" ")[0] ?? id;
  // Minutes rested so far this season, not counting this game's own plan.
  const restedSoFar = useMemo(() => {
    const totals = seasonTotals(Object.entries(saved).filter(([id]) => id !== gameId).map(([, p]) => p));
    return Object.fromEntries(Object.entries(totals).map(([id, t]) => [id, t.rested]));
  }, [saved, gameId]);
  const season = useMemo(() => seasonTotals(Object.values(saved)), [saved]);
  const blocks = blocksOf(shape, gameParts);
  // The team's own split (e.g. 9 innings) is offered too.
  const partOptions: [number, string][] = PARTS.some(([n]) => n === gameParts.count)
    ? PARTS
    : [[gameParts.count, partPlural(gameParts).replace(/^./, (c) => c.toUpperCase())], ...PARTS];

  const pickGame = (id: string) => {
    const g = games.find((x) => x.id === id);
    const p = saved[id] ?? null;
    setGameId(id);
    setPlan(p);
    setAvailable(p ? Object.keys(p.spots) : (g?.available ?? []));
    if (p?.shape) setShape(p.shape);
    if (p) setOnField(p.onField);
    if (p) setGoaliesStayOn(!!p.goaliesStayOn);
    setMsg(null);
  };

  const make = () => {
    if (!game) return;
    const ordered = players.map((p) => p.id).filter((id) => available.includes(id));
    setPlan(buildRotation({ players: ordered, shape, onField, goalies: game.goalies, gameParts, restedSoFar, goaliesStayOn }));
    setMsg(null);
  };

  const startOver = () =>
    start(async () => {
      if (saved[gameId]) {
        const res = await saveGameRotation(teamId, gameId, null);
        if (res.error) return setMsg(res.error);
        setSaved(({ [gameId]: _removed, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
      }
      setPlan(null);
      setMsg("Cleared. Change the settings and make a new one.");
    });

  const cycle = (player: string, i: number) =>
    setPlan((p) => (p ? { ...p, spots: { ...p.spots, [player]: p.spots[player].map((s, j) => (j === i ? NEXT[s] : s)) } } : p));

  if (!games.length) return <p className="text-sm text-zinc-500">No upcoming games to plan.</p>;
  const labels = plan?.labels ?? Array.from({ length: plan?.periods ?? 0 }, (_, i) => `P${i + 1}`);

  return (
    <div className="space-y-4 text-sm">
      <select value={gameId} onChange={(e) => pickGame(e.target.value)} className={field}>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.label}
            {saved[g.id] ? " (planned)" : ""}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block font-medium">Played in</span>
          <select value={shape.parts} onChange={(e) => setShape({ ...shape, parts: Number(e.target.value) })} className={field}>
            {partOptions.map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Minutes each</span>
          <input
            type="number"
            min={1}
            max={90}
            value={shape.partMinutes}
            onChange={(e) => setShape({ ...shape, partMinutes: Math.max(1, Number(e.target.value)) })}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Swap every</span>
          <select value={shape.swapEvery} onChange={(e) => setShape({ ...shape, swapEvery: Number(e.target.value) })} className={field}>
            {[3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
            <option value={0}>Each {shape.parts === 4 ? "quarter" : shape.parts === 1 ? "period" : "half"}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">On the field</span>
          <input type="number" min={1} max={30} value={onField} onChange={(e) => setOnField(Number(e.target.value))} className={field} />
          <span className="mt-0.5 block text-xs text-zinc-400">{role ? `Including the ${roleInText(role)}` : "Everyone playing at once"}</span>
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        {blocks.minutes.length} changes: {blocks.labels.join(" · ")}
      </p>
      {role && (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={goaliesStayOn} onChange={(e) => setGoaliesStayOn(e.target.checked)} className="mt-1" />
          <span>
            <span className="block font-medium">{rolePlural(role)} play the full game</span>
            <span className="block text-xs text-zinc-500">
              {game?.goalies.some(Boolean)
                ? `Whoever is ${roleInText(role)} for part of the game isn’t rested in the rest of it either.`
                : `No ${roleInText(rolePlural(role))} assigned for this game yet (see ${rolePlural(role)}).`}
            </span>
          </span>
        </label>
      )}

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
        <span className="mt-1 block text-xs text-zinc-400">Everyone except those marked Can’t make it.{role ? ` ${rolePlural(role)} come from the ${rolePlural(role)} section.` : ""}</span>
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
                  {labels.map((l, i) => (
                    <th key={i} className="whitespace-nowrap px-1 py-1 font-medium">
                      {l}
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
                        <button type="button" onClick={() => cycle(p, i)} className={`w-full min-w-9 rounded-md py-1.5 font-semibold ${CELL[s]}`}>
                          {s === "gk" ? roleCell(role) : CELL_LABEL[s]}
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
                  if (res.error) return setMsg(res.error);
                  setSaved((s) => ({ ...s, [gameId]: plan }));
                  setMsg("Saved. It counts towards the season balance.");
                })
              }
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"
            >
              {pending ? "Saving…" : "Save rotation"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => (!saved[gameId] || confirm("Delete the saved rotation for this game?")) && startOver()}
              className="rounded-xl border border-zinc-300 px-4 py-2.5"
            >
              Start over
            </button>
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
                      <td className="py-1 text-center">{t.played}′</td>
                      <td className="py-1 text-center">{t.rested}′</td>
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
