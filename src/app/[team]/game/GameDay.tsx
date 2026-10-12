"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { endGame, saveGame } from "./actions";
import { ourGoals, type LiveGame, type Spot } from "@/lib/game-live-shared";

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
function formation(ids: string[], keeper: string | null): Record<string, Spot> {
  const pos: Record<string, Spot> = {};
  const rest = ids.filter((id) => id !== keeper);
  if (keeper) pos[keeper] = { x: 50, y: 90 };
  const rows = Math.max(1, Math.ceil(rest.length / 3));
  rest.forEach((id, i) => {
    const row = Math.floor(i / 3);
    const inRow = Math.min(3, rest.length - row * 3);
    const col = i % 3;
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
}) {
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? "Player", [players]);
  const [g, setG] = useState<LiveGame>(() => {
    if (initial.onField.length) return initial;
    // First open: the rotation's first line-up (or the first players available), where they usually play.
    const first = plan ? Object.keys(plan.spots).filter((id) => isOn(plan.spots[id][0])) : available.slice(0, onFieldCount);
    const keeper = plan ? (Object.keys(plan.spots).find((id) => plan.spots[id][0] === "gk") ?? null) : null;
    const auto = formation(first, keeper);
    // Where they usually play, except the keeper: always in goal.
    return { ...initial, onField: first, pos: Object.fromEntries(first.map((id) => [id, id === keeper ? auto[id] : (layout[id] ?? auto[id])])) };
  });
  const [now, setNow] = useState(() => Date.now());
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
    setG((s) => ({ ...s, clock: { ...s.clock, runningSince: new Date().toISOString() }, startedAt: s.startedAt ?? new Date().toISOString() }));
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
      for (const { on, off } of s.pairs) {
        if (!onField.includes(off) || onField.includes(on)) continue;
        onField = onField.map((id) => (id === off ? on : id));
        pos[on] = pos[off];
      }
      return { ...st, onField, pos, doneSwaps: [...st.doneSwaps, s.at] };
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
      if (target && st.onField.includes(target)) {
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
      } else return st;
      return { ...st, onField, pos };
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

  const goal = (id: string, d: 1 | -1) =>
    setG((st) => ({ ...st, scorers: { ...st.scorers, [id]: Math.max(0, (st.scorers[id] ?? 0) + d) } }));

  const card = (id: string, field: boolean) => {
    const goals = g.scorers[id] ?? 0;
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
            aria-label={`Goal for ${nameOf(id)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => goal(id, 1)}
            className="grid size-6 place-items-center rounded-full bg-zinc-100 text-sm active:bg-emerald-200"
          >
            ⚽
          </button>
        )}
        <span className="max-w-20 truncate">{nameOf(id)}</span>
        {keepers.includes(id) && <span className="rounded bg-amber-400 px-1 text-[10px] font-bold text-zinc-900">{keeperTag}</span>}
        {goals > 0 && (
          <span className="flex items-center gap-0.5">
            <span className="rounded bg-emerald-600 px-1 text-[10px] text-white">{goals}</span>
            <button
              type="button"
              aria-label="Take a goal off"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => goal(id, -1)}
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
            <div className="text-3xl font-bold tabular-nums">{ourGoals(g)}</div>
            <button type="button" onClick={() => setG((s) => ({ ...s, ownGoals: s.ownGoals + 1 }))} className="text-[11px] text-zinc-500 underline">
              + own goal
            </button>
            {g.ownGoals > 0 && (
              <button type="button" onClick={() => setG((s) => ({ ...s, ownGoals: s.ownGoals - 1 }))} className="ml-1 text-[11px] text-zinc-400">
                −
              </button>
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
          </div>
          <div className="text-center">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">{title.replace(/^vs |^@ /, "")}</div>
            <div className="text-3xl font-bold tabular-nums">{g.them}</div>
            <span className="flex justify-center gap-2 text-sm">
              <button type="button" onClick={() => setG((s) => ({ ...s, them: Math.max(0, s.them - 1) }))} className="px-1 text-zinc-400">
                −
              </button>
              <button type="button" onClick={() => setG((s) => ({ ...s, them: s.them + 1 }))} className="px-1 font-semibold">
                +
              </button>
            </span>
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
      <div ref={pitch} className="relative aspect-[68/100] w-full overflow-hidden rounded-2xl bg-emerald-700 shadow-inner">
        <Pitch />
        {g.onField.map((id) => card(id, true))}
      </div>

      {/* The sideline */}
      <div ref={side} className="min-h-14 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Sideline · drag onto a player to swap</div>
        <div className="flex flex-wrap gap-1.5">
          {bench.map((id) => card(id, false))}
          {!bench.length && <span className="text-xs text-zinc-400">Everyone’s on.</span>}
        </div>
      </div>

      {!g.ended ? (
        <button
          type="button"
          onClick={() =>
            confirm(`Full time? ${ourGoals(g)}–${g.them} goes into the team’s results.`) &&
            endGame(teamId, gameId, { ...g, ended: true }).then(() => setG((s) => ({ ...s, ended: true, clock: { elapsedMs: elapsed, runningSince: null } })))
          }
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold"
        >
          Full time
        </button>
      ) : (
        <p className="text-center text-sm text-emerald-700">Full time: {ourGoals(g)}–{g.them}, saved to the team’s results.</p>
      )}

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

/** A soccer pitch from above: our goal at the bottom. */
function Pitch() {
  return (
    <svg viewBox="0 0 68 100" className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
      <g fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.5">
        <rect x="2" y="2" width="64" height="96" />
        <line x1="2" y1="50" x2="66" y2="50" />
        <circle cx="34" cy="50" r="8" />
        <rect x="14" y="2" width="40" height="15" />
        <rect x="24" y="2" width="20" height="5.5" />
        <rect x="14" y="83" width="40" height="15" />
        <rect x="24" y="92.5" width="20" height="5.5" />
        <rect x="29" y="0.5" width="10" height="1.5" />
        <rect x="29" y="98" width="10" height="1.5" />
      </g>
      <circle cx="34" cy="50" r="0.7" fill="rgba(255,255,255,0.8)" />
    </svg>
  );
}
