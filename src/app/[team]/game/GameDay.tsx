"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endGame, saveGame, saveGameData } from "./actions";
import { ourCounts, ourGoals, pointsOf, scoresOf, stamp, theirGoals, type Counts, type LiveGame, type Spot } from "@/lib/game-live-shared";
import { sportOf, type Sport, type SportId } from "@/lib/sports";
import { Field, FIELD_BOX, ScoreIcon } from "./fields";

type Player = { id: string; name: string };
type Plan = { minutes: number[]; spots: Record<string, ("on" | "rest" | "gk")[]>; parts: number | null; partMinutes: number | null } | null;
type Swap = { at: number; pairs: { on: string; off: string }[]; ins: string[]; outs: string[] }; // at: minute of the game

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const isOn = (s: string | undefined) => s === "on" || s === "gk";

/** The rotation's swaps: at each block change, who comes on and who goes off. */
function swapsOf(plan: Plan): Swap[] {
  if (!plan) return [];
  const out: Swap[] = [];
  let at = 0;
  for (let i = 1; i < plan.minutes.length; i++) {
    at += plan.minutes[i - 1];
    const ins = Object.keys(plan.spots).filter((id) => isOn(plan.spots[id][i]) && !isOn(plan.spots[id][i - 1]));
    const outs = Object.keys(plan.spots).filter((id) => !isOn(plan.spots[id][i]) && isOn(plan.spots[id][i - 1]));
    if (ins.length || outs.length) out.push({ at, ins, outs, pairs: ins.slice(0, outs.length).map((on, k) => ({ on, off: outs[k] })) });
  }
  return out;
}

/** A sensible starting spot for each player: the keeper in goal, the rest in rows. */
function formation(ids: string[], keeper: string | null, sport: Sport): Record<string, Spot> {
  const pos: Record<string, Spot> = {};
  const rest = ids.filter((id) => id !== keeper);
  if (keeper && sport.keeper) pos[keeper] = { x: sport.keeper.x, y: sport.keeper.y };
  const per = rest.length > 9 ? 4 : 3;
  const rows = Math.max(1, Math.ceil(rest.length / per));
  rest.forEach((id, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, rest.length - row * per);
    const col = i % per;
    pos[id] = { x: ((col + 1) * 100) / (inRow + 1), y: 72 - (row * 52) / Math.max(1, rows - 1 || 1) };
  });
  return pos;
}

// My Game: the coach's sideline screen. The field (drag players around, or a
// player from the sideline onto one on the field to swap them), the clock with
// the rotation's swaps as suggestions, and the score (tap the ball on a card).
export function GameDay({
  teamId,
  gameId,
  title,
  players,
  available,
  plan,
  onFieldCount,
  layout,
  initial,
  keeperTag,
  roleWord,
  sport,
}: {
  teamId: string;
  gameId: string;
  title: string;
  players: Player[];
  available: string[];
  plan: Plan;
  onFieldCount: number;
  layout: Record<string, Spot>;
  initial: LiveGame;
  keeperTag: string; // "GK", or the team's role ("Cat" for a catcher)
  roleWord: string | null; // "goalie" (or the team's role) when the team keeps that tally
  sport: SportId;
}) {
  const sp = sportOf(sport);
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? "Player", [players]);
  const [g, setG] = useState<LiveGame>(() => {
    // Scores in the sport's kinds (games from before sports had goals only).
    const sc = scoresOf(initial);
    const base: LiveGame = { ...initial, sport: sp.id, marks: sc.mine, teamMarks: sc.team, themMarks: sc.them, scorers: {}, ownGoals: 0, them: 0 };
    if (initial.onField.length) return base;
    // First open: the rotation's first line-up (or the first players available), where they usually play.
    const first = plan ? Object.keys(plan.spots).filter((id) => isOn(plan.spots[id][0])) : available.slice(0, onFieldCount);
    if (sp.positions) {
      // Netball: a bib each, in order, standing in its area.
      const pos: Record<string, Spot> = {};
      const bibs: Record<string, string> = {};
      first.forEach((id, i) => {
        const p = sp.positions![i];
        pos[id] = p ? { x: p.x, y: p.y } : { x: 50, y: 50 };
        if (p) bibs[id] = p.name;
      });
      return { ...base, onField: first, pos, bibs };
    }
    const keeper = plan && sp.keeper ? (Object.keys(plan.spots).find((id) => plan.spots[id][0] === "gk") ?? null) : null;
    const auto = formation(first, keeper, sp);
    // Where they usually play, except the keeper: always in goal. A usual spot in goal (they kept
    // goal last time) or on top of someone already placed goes back to the formation, so no card hides another.
    const pos: Record<string, Spot> = {};
    const near = (p: Spot) => Object.values(pos).some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 9);
    if (keeper && auto[keeper]) pos[keeper] = auto[keeper];
    for (const id of first.filter((p) => p !== keeper)) {
      const usual = layout[id];
      pos[id] = usual && usual.y < (sp.keeper?.area ?? 101) && !near(usual) ? usual : auto[id];
    }
    return { ...base, onField: first, pos };
  });
  const [now, setNow] = useState(() => Date.now());
  const [savingData, setSavingData] = useState(false);
  const swaps = useMemo(() => swapsOf(plan), [plan]);
  const bench = available.filter((id) => !g.onField.includes(id));

  // Save as we go (a moment after the last change).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => void saveGame(teamId, gameId, g), 600);
    return () => clearTimeout(t);
  }, [g, teamId, gameId]);

  // The clock.
  const running = !!g.clock.runningSince;
  const elapsed = g.clock.elapsedMs + (g.clock.runningSince ? now - Date.parse(g.clock.runningSince) : 0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  // Keep the screen on while the clock runs (phones can't buzz from a locked screen in a browser).
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
      .request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [running]);
  const start = () =>
    setG((s) => stamp({ ...s, clock: { ...s.clock, runningSince: new Date().toISOString() }, startedAt: s.startedAt ?? new Date().toISOString() }, Date.now()));
  const pause = () =>
    setG((s) => (s.clock.runningSince ? { ...s, clock: { elapsedMs: s.clock.elapsedMs + (Date.now() - Date.parse(s.clock.runningSince)), runningSince: null } } : s));

  // Halves (or quarters): the clock stops at the break.
  const partMs = plan?.partMinutes ? plan.partMinutes * 60_000 : null;
  const part = partMs ? Math.min((plan?.parts ?? 1) - 1, Math.floor(elapsed / partMs)) : 0;
  useEffect(() => {
    if (!running || !partMs || !plan?.parts) return;
    const ends = Array.from({ length: plan.parts }, (_, i) => (i + 1) * partMs);
    const end = ends.find((e) => g.clock.elapsedMs < e && elapsed >= e);
    if (end !== undefined) {
      queueMicrotask(() => setG((s) => ({ ...s, clock: { elapsedMs: end, runningSince: null } })));
      alertNow();
    }
  }, [elapsed, running, partMs, plan?.parts, g.clock.elapsedMs]);
  const partName = plan?.parts === 4 ? `Q${part + 1}` : plan?.parts === 2 ? (part ? "2nd half" : "1st half") : plan?.parts && plan.parts > 1 ? `Part ${part + 1}` : "";

  // Who's in goal now, per the rotation (the tag on their card follows it through the game).
  const block = (() => {
    if (!plan) return 0;
    let t = 0;
    for (let i = 0; i < plan.minutes.length; i++) {
      t += plan.minutes[i] * 60_000;
      if (elapsed < t) return i;
    }
    return plan.minutes.length - 1;
  })();
  const keepers = plan ? Object.keys(plan.spots).filter((id) => plan.spots[id][block] === "gk") : [];

  // The rotation's next swap: a suggestion, the coach decides.
  const due = swaps.find((s) => !g.doneSwaps.includes(s.at) && elapsed >= s.at * 60_000);
  const next = swaps.find((s) => !g.doneSwaps.includes(s.at) && elapsed < s.at * 60_000);
  const alerted = useRef<number | null>(null);
  useEffect(() => {
    if (due && alerted.current !== due.at) {
      alerted.current = due.at;
      alertNow();
    }
  }, [due]);
  const doSwap = (s: Swap) =>
    setG((st) => {
      let onField = [...st.onField];
      const pos = { ...st.pos };
      const bibs = { ...(st.bibs ?? {}) };
      for (const { on, off } of s.pairs) {
        if (!onField.includes(off) || onField.includes(on)) continue;
        onField = onField.map((id) => (id === off ? on : id));
        pos[on] = pos[off];
        if (bibs[off]) [bibs[on], bibs[off]] = [bibs[off], ""];
      }
      return stamp({ ...st, onField, pos, bibs: tidyBibs(bibs), doneSwaps: [...st.doneSwaps, s.at] }, Date.now());
    });
  const skip = (s: Swap) => setG((st) => ({ ...st, doneSwaps: [...st.doneSwaps, s.at] }));

  // Dragging: a sideline player onto a field player swaps them; a field player
  // onto another swaps places, onto grass moves there, onto the sideline comes off.
  const pitch = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement>(null);
  type Drag = { id: string; x: number; y: number; moved: boolean; sx: number; sy: number };
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const drop = (id: string, x: number, y: number) => {
    const target = document
      .elementsFromPoint(x, y)
      .map((el) => (el as HTMLElement).closest?.("[data-player]") as HTMLElement | null)
      .find((el) => el && el.dataset.player !== id)?.dataset.player;
    const box = pitch.current?.getBoundingClientRect();
    const onPitch = box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    const onSide = (() => {
      const b = side.current?.getBoundingClientRect();
      return b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    })();
    setG((st) => {
      const fromField = st.onField.includes(id);
      let onField = [...st.onField];
      const pos = { ...st.pos };
      const bibs = { ...(st.bibs ?? {}) }; // netball: the bib goes with the spot
      if (target && st.onField.includes(target)) {
        [bibs[id], bibs[target]] = [bibs[target] ?? "", fromField ? (bibs[id] ?? "") : ""];
        if (fromField) [pos[id], pos[target]] = [pos[target], pos[id]]; // swap places
        else {
          onField = onField.map((p) => (p === target ? id : p)); // sideline player takes over
          pos[id] = pos[target];
        }
      } else if (onPitch && box) {
        pos[id] = { x: ((x - box.left) / box.width) * 100, y: ((y - box.top) / box.height) * 100 };
        if (!fromField) onField.push(id);
      } else if (onSide && fromField) {
        onField = onField.filter((p) => p !== id);
        bibs[id] = "";
      } else return st;
      return stamp({ ...st, onField, pos, bibs: tidyBibs(bibs) }, Date.now()); // playing time counts from here
    });
  };

  const down = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDrag({ id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
  };
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d) setDrag({ ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6 });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d?.moved) drop(d.id, e.clientX, e.clientY);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scoring, in the sport's kinds (goal; +1, +2, +3; goal and behind).
  const bump = (c: Counts | undefined, kind: string, d: number) => ({ ...(c ?? {}), [kind]: Math.max(0, (c?.[kind] ?? 0) + d) });
  const mark = (id: string, kind: string, d: 1 | -1) => setG((st) => ({ ...st, marks: { ...(st.marks ?? {}), [id]: bump(st.marks?.[id], kind, d) } }));
  const teamMark = (d: 1 | -1) => sp.teamScore && setG((st) => ({ ...st, teamMarks: bump(st.teamMarks, sp.teamScore!.key, d) }));
  const themMark = (kind: string, d: 1 | -1) => setG((st) => ({ ...st, themMarks: bump(st.themMarks, kind, d) }));
  // Basketball: take one point off theirs (a 2 becomes a 1, and so on).
  const themMinusPoint = () =>
    setG((st) => {
      const c = { ...(st.themMarks ?? {}) };
      if (c.p1) c.p1--;
      else if (c.p2) [c.p2, c.p1] = [c.p2 - 1, (c.p1 ?? 0) + 1];
      else if (c.p3) [c.p3, c.p2] = [c.p3 - 1, (c.p2 ?? 0) + 1];
      return { ...st, themMarks: c };
    });
  const badge = (c: Counts) => (sp.id === "afl" ? `${c.goal ?? 0}.${c.behind ?? 0}` : String(pointsOf(sp, c)));
  const [picker, setPicker] = useState<{ id: string; d: 1 | -1 } | null>(null);
  const single = sp.kinds.length === 1;
  // Netball: tap a bib for the next free position (or none).
  const cycleBib = (id: string) =>
    setG((st) => {
      const names = (sp.positions ?? []).map((p) => p.name);
      const bibs = { ...(st.bibs ?? {}) };
      const taken = new Set(Object.entries(bibs).filter(([p]) => p !== id && st.onField.includes(p)).map(([, b]) => b));
      const next = names.slice(bibs[id] ? names.indexOf(bibs[id]) + 1 : 0).find((n) => !taken.has(n));
      bibs[id] = next ?? "";
      return { ...st, bibs: tidyBibs(bibs) };
    });

  const card = (id: string, field: boolean) => {
    const mine = g.marks?.[id] ?? {};
    const scored = pointsOf(sp, mine) > 0;
    const bib = g.bibs?.[id];
    return (
      <div
        key={id}
        data-player={id}
        onPointerDown={down(id)}
        style={field ? { left: `${g.pos[id]?.x ?? 50}%`, top: `${g.pos[id]?.y ?? 50}%` } : undefined}
        className={`${field ? "absolute -translate-x-1/2 -translate-y-1/2" : ""} flex touch-none select-none items-center gap-1 rounded-lg bg-white px-1.5 py-1 text-xs font-semibold text-zinc-900 shadow-md ${drag?.id === id && drag.moved ? "opacity-30" : ""}`}
      >
        {field && (
          <button
            type="button"
            aria-label={`Score for ${nameOf(id)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => (single ? mark(id, sp.kinds[0].key, 1) : setPicker({ id, d: 1 }))}
            className="grid size-6 place-items-center rounded-full bg-zinc-100 text-sm active:bg-emerald-200"
          >
            <ScoreIcon sport={sp.id} />
          </button>
        )}
        {field && sp.positions && (
          <button
            type="button"
            aria-label={`Position for ${nameOf(id)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => cycleBib(id)}
            className={`rounded px-1 text-[10px] font-bold ${bib ? "bg-amber-400 text-zinc-900" : "border border-dashed border-zinc-400 text-zinc-400"}`}
          >
            {bib || "Bib"}
          </button>
        )}
        <span className="max-w-20 truncate">{nameOf(id)}</span>
        {keepers.includes(id) && <span className="rounded bg-amber-400 px-1 text-[10px] font-bold text-zinc-900">{keeperTag}</span>}
        {scored && (
          <span className="flex items-center gap-0.5">
            <span className="rounded bg-emerald-600 px-1 text-[10px] text-white">{badge(mine)}</span>
            <button
              type="button"
              aria-label="Take a score off"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => (single ? mark(id, sp.kinds[0].key, -1) : setPicker({ id, d: -1 }))}
              className="px-0.5 text-zinc-400"
            >
              −
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Score and clock */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">Us</div>
            <ScoreBig sport={sp} counts={ourCounts(g)} />
            {sp.teamScore && (
              <>
                <button type="button" onClick={() => teamMark(1)} className="text-[11px] text-zinc-500 underline">
                  + {sp.teamScore.label}
                </button>
                {(g.teamMarks?.[sp.teamScore.key] ?? 0) > 0 && (
                  <button type="button" onClick={() => teamMark(-1)} className="ml-1 text-[11px] text-zinc-400">
                    −
                  </button>
                )}
              </>
            )}
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500">{partName}</div>
            <div className="text-4xl font-bold tabular-nums">{mmss(elapsed)}</div>
            {!g.ended && (
              <button
                type="button"
                onClick={running ? pause : start}
                className={`mt-1 rounded-full px-4 py-1.5 text-sm font-semibold text-white ${running ? "bg-zinc-900" : "bg-emerald-600"}`}
              >
                {running ? "Pause" : elapsed ? "Start again" : "Kick-off"}
              </button>
            )}
            {!g.ended && elapsed > 0 && (
              <button
                type="button"
                onClick={() =>
                  // Back to 0:00 and the rotation's swaps from the start. The score stays (it has its own − buttons).
                  confirm("Reset the clock to 0:00?") && setG((s) => stamp({ ...s, clock: { elapsedMs: 0, runningSince: null }, doneSwaps: [], log: [] }, Date.now()))
                }
                className="mt-1 block w-full text-[11px] text-zinc-500 underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{title.replace(/^vs |^@ /, "")}</div>
            <ScoreBig sport={sp} counts={g.themMarks ?? {}} />
            {sp.id === "basketball" ? (
              <span className="flex justify-center gap-1.5 text-sm">
                <button type="button" onClick={themMinusPoint} className="px-0.5 text-zinc-400">
                  −1
                </button>
                {sp.kinds.map((k) => (
                  <button key={k.key} type="button" onClick={() => themMark(k.key, 1)} className="px-0.5 font-semibold">
                    {k.label}
                  </button>
                ))}
              </span>
            ) : (
              sp.kinds.map((k) => (
                <span key={k.key} className="flex items-center justify-center gap-2 text-sm">
                  {!single && <span className="text-[11px] text-zinc-500">{k.label}</span>}
                  <button type="button" onClick={() => themMark(k.key, -1)} className="px-1 text-zinc-400">
                    −
                  </button>
                  <button type="button" onClick={() => themMark(k.key, 1)} className="px-1 font-semibold">
                    +
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* The rotation's swap: a suggestion */}
      {due ? (
        <section className="animate-pulse rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-sm">
          <div className="font-semibold text-amber-900">Swap time ({due.at}’)</div>
          <SwapText s={due} nameOf={nameOf} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => doSwap(due)} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white">
              Do it
            </button>
            <button type="button" onClick={() => skip(due)} className="rounded-lg border border-zinc-300 px-3 py-1.5">
              Skip
            </button>
          </div>
        </section>
      ) : next ? (
        <section className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
          Next swap in <b className="tabular-nums text-zinc-900">{mmss(next.at * 60_000 - elapsed)}</b>: <SwapText s={next} nameOf={nameOf} inline />
        </section>
      ) : null}

      {/* The field */}
      <div ref={pitch} className={`relative w-full overflow-hidden rounded-2xl shadow-inner ${FIELD_BOX[sp.id]}`}>
        <Field sport={sp.id} />
        {g.onField.map((id) => card(id, true))}
        {picker && (
          // What they scored (or what to take off), for sports with more than one kind of score.
          <div className="absolute inset-x-2 bottom-2 z-20 rounded-xl bg-white p-2 text-sm shadow-xl">
            <div className="mb-1.5 font-semibold">
              {nameOf(picker.id)}: {picker.d === 1 ? "what did they score?" : "take off"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sp.kinds
                .filter((k) => picker.d === 1 || (g.marks?.[picker.id]?.[k.key] ?? 0) > 0)
                .map((k) => (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => {
                      mark(picker.id, k.key, picker.d);
                      setPicker(null);
                    }}
                    className={`rounded-lg px-3 py-1.5 font-semibold ${picker.d === 1 ? "bg-emerald-600 text-white" : "border border-zinc-300"}`}
                  >
                    {picker.d === 1 ? k.label : `− ${k.label.replace(/^\+/, "")}`}
                  </button>
                ))}
              <button type="button" onClick={() => setPicker(null)} className="rounded-lg px-3 py-1.5 text-zinc-500">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* The sideline */}
      <div ref={side} className="min-h-14 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{sp.bench} · drag onto a player to swap</div>
        <div className="flex flex-wrap gap-1.5">
          {bench.map((id) => card(id, false))}
          {!bench.length && <span className="text-xs text-zinc-400">Everyone’s on.</span>}
        </div>
      </div>

      {!g.ended ? (
        <button
          type="button"
          onClick={() =>
            confirm(`Full time? ${ourGoals(g)}–${theirGoals(g)} goes into the team’s results.`) &&
            endGame(teamId, gameId, { ...g, ended: true }).then(() => setG((s) => ({ ...s, ended: true, clock: { elapsedMs: elapsed, runningSince: null } })))
          }
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Full time
        </button>
      ) : (
        <div className="space-y-2 text-center">
          <p className="text-sm text-emerald-700">Full time: {ourGoals(g)}–{theirGoals(g)}, saved to the team’s results.</p>
          <button
            type="button"
            disabled={savingData}
            onClick={() => {
              setSavingData(true);
              saveGameData(teamId, gameId)
                .then((r) => {
                  if ("saved" in r && r.saved) setG((s) => ({ ...s, saved: r.saved }));
                  else if ("error" in r) alert(r.error);
                })
                .finally(() => setSavingData(false));
            }}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold ${g.saved ? "border border-zinc-300 bg-white" : "bg-emerald-600 text-white"}`}
          >
            {savingData ? "Saving…" : g.saved ? "Save game data again" : "Save game data"}
          </button>
          <p className="text-xs text-zinc-500">
            {g.saved
              ? `Saved: playing time, ${sp.tally.toLowerCase()}` + (roleWord ? ` and ${roleWord}` : "") + " are in the season tallies in Manager’s Corner."
              : `Adds each player’s playing time, ${sp.tally.toLowerCase()}` + (roleWord ? ` and time as ${roleWord}` : "") + " to the season tallies in Manager’s Corner."}
          </p>
        </div>
      )}
      <Link href={`/${teamId}/admin?open=rotation#rotation`} className="block text-center text-sm text-zinc-600 underline">
        Game rotation
      </Link>

      {drag?.moved && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white px-2 py-1 text-xs font-semibold shadow-xl ring-2 ring-emerald-500" style={{ left: drag.x, top: drag.y }}>
          {nameOf(drag.id)}
        </div>
      )}
    </div>
  );
}

function SwapText({ s, nameOf, inline = false }: { s: Swap; nameOf: (id: string) => string; inline?: boolean }) {
  const parts = [
    ...s.pairs.map((p) => `${nameOf(p.on)} on for ${nameOf(p.off)}`),
    ...s.ins.slice(s.pairs.length).map((id) => `${nameOf(id)} on`),
    ...s.outs.slice(s.pairs.length).map((id) => `${nameOf(id)} off`),
  ];
  return inline ? <span>{parts.join(" · ")}</span> : <p className="mt-0.5 text-amber-900">{parts.join(" · ")}</p>;
}

/** A buzz and a beep (if the phone allows). */
function alertNow() {
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {}
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {}
}

/** Empty bibs (nobody in that position) are left out. */
const tidyBibs = (b: Record<string, string>) => Object.fromEntries(Object.entries(b).filter(([, v]) => v));

/** A team's score, as the sport shows it: AFL as goals.behinds (points). */
function ScoreBig({ sport, counts }: { sport: Sport; counts: Counts }) {
  if (sport.id !== "afl") return <div className="text-3xl font-bold tabular-nums">{pointsOf(sport, counts)}</div>;
  return (
    <div className="tabular-nums">
      <span className="text-2xl font-bold">
        {counts.goal ?? 0}.{counts.behind ?? 0}
      </span>{" "}
      <span className="text-lg font-semibold text-zinc-500">({pointsOf(sport, counts)})</span>
    </div>
  );
}
