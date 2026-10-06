"use client";

import { useState } from "react";

// The whole draw before it's saved: as a list by round, or on a calendar.
// A team filter shows one team's season in either view.

export type PreviewGame = {
  round: number;
  date: string; // yyyy-mm-dd, in the league's timezone
  day: string; // "Sat, 7 Nov"
  time: string; // "8:30 am"
  pitch: string;
  home: string;
  away: string;
};

const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DrawPreview({
  games,
  teams,
  breaks,
}: {
  games: PreviewGame[];
  teams: string[];
  breaks: { from: string; to: string }[];
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [team, setTeam] = useState("");
  const shown = team ? games.filter((g) => g.home === team || g.away === team) : games;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex rounded-xl bg-zinc-100 p-0.5">
          {(["list", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {v === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>
        <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Show one team" className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-2 py-1.5 text-xs">
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {view === "list" ? <ListView games={shown} team={team} /> : <CalendarView games={shown} breaks={breaks} team={team} />}
    </div>
  );
}

function GameLine({ g, team }: { g: PreviewGame; team: string }) {
  const name = (t: string) => <span className={t === team ? "font-semibold text-zinc-900" : ""}>{t}</span>;
  return (
    <li className="flex gap-2 py-1">
      <span className="w-16 shrink-0 tabular-nums text-zinc-500">{g.time}</span>
      <span className="min-w-0 flex-1">
        {name(g.home)} <span className="text-zinc-400">v</span> {name(g.away)}
        {g.pitch && <span className="block text-[11px] text-zinc-400">{g.pitch}</span>}
      </span>
    </li>
  );
}

function ListView({ games, team }: { games: PreviewGame[]; team: string }) {
  const rounds = new Map<number, PreviewGame[]>();
  for (const g of games) rounds.set(g.round, [...(rounds.get(g.round) ?? []), g]);
  return (
    <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 p-3">
      {[...rounds.entries()].map(([round, list]) => (
        <div key={round}>
          <div className="mb-0.5 flex justify-between text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <span>Round {round}</span>
            <span>{[...new Set(list.map((g) => g.day))].join(" & ")}</span>
          </div>
          <ul className="divide-y divide-zinc-100 text-xs text-zinc-700">
            {list.map((g, i) => (
              <GameLine key={i} g={g} team={team} />
            ))}
          </ul>
        </div>
      ))}
      {team && rounds.size === 0 && <p className="text-xs text-zinc-500">No games for {team}.</p>}
    </div>
  );
}

function CalendarView({ games, breaks, team }: { games: PreviewGame[]; breaks: { from: string; to: string }[]; team: string }) {
  const byDate = new Map<string, PreviewGame[]>();
  for (const g of games) byDate.set(g.date, [...(byDate.get(g.date) ?? []), g]);
  const dates = [...byDate.keys()].sort();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && byDate.has(picked) ? picked : (dates[0] ?? null);
  if (!dates.length) return <p className="text-xs text-zinc-500">No games{team ? ` for ${team}` : ""}.</p>;

  // Every month from the first game to the last.
  const months: { y: number; m: number }[] = [];
  const [fy, fm] = dates[0].split("-").map(Number);
  const [ly, lm] = dates[dates.length - 1].split("-").map(Number);
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) months.push({ y, m });
  const inBreak = (iso: string) => breaks.some((b) => b.from && b.to && iso >= b.from && iso <= b.to);
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="max-h-[22rem] space-y-4 overflow-y-auto rounded-xl border border-zinc-200 p-3">
        {months.map(({ y, m }) => {
          const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
          return (
            <div key={`${y}-${m}`}>
              <div className="mb-1 text-xs font-semibold text-zinc-700">{MONTH.format(new Date(Date.UTC(y, m - 1, 1)))}</div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
                {WEEK.map((w) => (
                  <div key={w} className="pb-0.5 text-zinc-400">
                    {w.slice(0, 2)}
                  </div>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <div key={`x${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = iso(y, m, i + 1);
                  const count = byDate.get(day)?.length ?? 0;
                  const isSel = day === selected;
                  const cls = count
                    ? isSel
                      ? "bg-zinc-900 font-semibold text-white"
                      : "bg-accent font-semibold text-on-accent"
                    : inBreak(day)
                      ? "bg-zinc-100 text-zinc-300 line-through"
                      : "text-zinc-500";
                  return count ? (
                    <button key={day} type="button" onClick={() => setPicked(day)} className={`relative rounded-md py-1.5 ${cls}`} title={`${count} game${count > 1 ? "s" : ""}`}>
                      {i + 1}
                      {!team && <span className="absolute right-0.5 top-0 text-[8px] font-normal opacity-80">{count}</span>}
                    </button>
                  ) : (
                    <div key={day} className={`rounded-md py-1.5 ${cls}`}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-accent" /> Game day
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-zinc-100" /> Break
        </span>
      </div>
      {selected && (
        <div className="rounded-xl bg-zinc-50 p-3">
          <div className="mb-0.5 text-xs font-semibold text-zinc-700">
            {byDate.get(selected)![0].day} · Round {[...new Set(byDate.get(selected)!.map((g) => g.round))].join(", ")}
          </div>
          <ul className="divide-y divide-zinc-200 text-xs text-zinc-700">
            {byDate.get(selected)!.map((g, i) => (
              <GameLine key={i} g={g} team={team} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
