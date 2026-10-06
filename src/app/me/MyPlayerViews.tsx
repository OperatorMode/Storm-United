"use client";

import { useEffect, useState, type ReactNode } from "react";

export type CalendarDay = {
  date: string; // yyyy-mm-dd
  title: string; // "Saturday 7 Nov"
  count: number;
  clash: boolean; // a child has two things at once that day
  training: boolean; // only training that day
  node: ReactNode; // that day's cards
};

const VIEW_KEY = "su_myplayer_view";
const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// My Player as a list (every day in order) or a calendar (tap a day).
export function MyPlayerViews({ list, days }: { list: ReactNode; days: CalendarDay[] }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [picked, setPicked] = useState<string | null>(null);

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
          <Months days={days} selected={selected} onPick={setPicked} />
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
            <Legend className="bg-zinc-900" text="Game" />
            <Legend className="bg-emerald-600" text="Training" />
            <Legend className="bg-red-600" text="Clash" />
          </div>
          {selected && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{byDate.get(selected)!.title}</h2>
              {byDate.get(selected)!.node}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 rounded ${className}`} /> {text}
    </span>
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
                const colour = day.clash ? "bg-red-600 text-white" : day.training ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white";
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onPick(date)}
                    className={`relative rounded-lg py-2 font-semibold ${colour} ${date === selected ? "ring-2 ring-accent ring-offset-1" : ""}`}
                  >
                    {i + 1}
                    {day.count > 1 && <span className="absolute right-0.5 top-0 text-[9px] font-normal opacity-80">{day.count}</span>}
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
