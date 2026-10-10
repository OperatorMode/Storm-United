"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type CalendarDay = {
  date: string; // yyyy-mm-dd
  title: string; // "Saturday 7 Nov"
  count: number;
  clash: boolean; // a clash still to solve that day
  resolved?: boolean; // a clash that day, and it's been solved (who's taking whom, or not going)
  training: boolean; // only training that day
  duty: boolean; // the family is on a duty that day
  kids: { key: string; training: boolean }[]; // a dot per child (hollow = training)
  node: ReactNode; // that day's cards
};

const VIEW_KEY = "su_myplayer_view";
const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// My Player as a list (every day in order) or a calendar (tap a day).
export function MyPlayerViews({ list, days }: { list: ReactNode; days: CalendarDay[] }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [picked, setPicked] = useState<string | null>(null);
  const dayRef = useRef<HTMLElement>(null);
  // Tapping a day brings its cards into view.
  const pick = (date: string) => {
    setPicked(date);
    requestAnimationFrame(() => dayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(VIEW_KEY);
    } catch {}
    if (saved === "calendar") queueMicrotask(() => setView("calendar"));
  }, []);
  const choose = (v: "list" | "calendar") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const byDate = new Map(days.map((d) => [d.date, d]));
  const selected = picked && byDate.has(picked) ? picked : (days[0]?.date ?? null);

  return (
    <div className="space-y-4">
      <div className="flex rounded-xl bg-zinc-200/70 p-0.5">
        {(["list", "calendar"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => choose(v)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
          >
            {v === "list" ? "List" : "Calendar"}
          </button>
        ))}
      </div>

      {view === "list" ? (
        list
      ) : days.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">No games coming up.</p>
      ) : (
        <>
          <Months days={days} selected={selected} onPick={pick} />
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-zinc-500" /> Game
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ boxShadow: "inset 0 0 0 1.5px #71717a" }} /> Training
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded ring-2 ring-red-600" /> Clash
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 rounded ring-2 ring-emerald-500" /> Resolved
            </span>
            <span className="flex items-center gap-1">
              <span className="text-amber-500">★</span> Your duty
            </span>
          </div>
          {selected && (
            <section ref={dayRef} className="scroll-mt-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{byDate.get(selected)!.title}</h2>
              {byDate.get(selected)!.node}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Months({ days, selected, onPick }: { days: CalendarDay[]; selected: string | null; onPick: (d: string) => void }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [fy, fm] = days[0].date.split("-").map(Number);
  const [ly, lm] = days[days.length - 1].date.split("-").map(Number);
  const months: { y: number; m: number }[] = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) months.push({ y, m });
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="max-h-[26rem] space-y-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      {months.map(({ y, m }) => {
        const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
        return (
          <div key={`${y}-${m}`}>
            <div className="mb-1 text-sm font-semibold">{MONTH.format(new Date(Date.UTC(y, m - 1, 1)))}</div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {WEEK.map((w) => (
                <div key={w} className="pb-0.5 text-zinc-400">
                  {w}
                </div>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <div key={`x${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = iso(y, m, i + 1);
                const day = byDate.get(date);
                if (!day) {
                  return (
                    <div key={date} className="py-2 text-zinc-400">
                      {i + 1}
                    </div>
                  );
                }
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onPick(date)}
                    className={`relative rounded-lg bg-zinc-100 pb-3 pt-1.5 font-semibold text-zinc-900 ${day.clash ? "ring-2 ring-red-600" : day.resolved ? "ring-2 ring-emerald-500" : date === selected ? "ring-2 ring-zinc-900" : ""}`}
                  >
                    {i + 1}
                    {day.duty && <span className="absolute left-0.5 top-0 text-[9px] text-amber-500">★</span>}
                    <span className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
                      {day.kids.slice(0, 4).map((k, n) => (
                        <span
                          key={n}
                          data-kid={k.key}
                          className="size-1.5 rounded-full"
                          style={k.training ? { boxShadow: "inset 0 0 0 1.5px var(--kid, #71717a)" } : { background: "var(--kid, #71717a)" }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
