"use client";

import { useState, useTransition } from "react";
import { generateDrawAction, previewDrawAction } from "./actions";
import type { DrawSettings } from "@/lib/season-draw";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "mb-1 block text-sm font-medium";
const STEPS = ["Season", "Days & times", "Where", "Game", "Preview"] as const;
const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

type Preview = Awaited<ReturnType<typeof previewDrawAction>>;

const defaults = (venue: string): DrawSettings => ({
  start: "",
  end: "",
  breaks: [],
  meetings: 1,
  finalsWeeks: 0,
  days: [6],
  windowStart: "08:30",
  windowEnd: "14:00",
  venueMode: "single",
  venue,
  pitches: "2",
  homeGrounds: {},
  groundPitches: 1,
  periods: 2,
  periodMinutes: 20,
  breakMinutes: 5,
  changeover: 5,
});

const storageKey = (id: string) => `sidelnr-draw-${id}`;
function loadSaved(id: string, venue: string): DrawSettings {
  try {
    const saved = localStorage.getItem(storageKey(id));
    if (saved) return { ...defaults(venue), ...JSON.parse(saved) };
  } catch {}
  return defaults(venue);
}

const clock = (min: number) => {
  const h = Math.floor(min / 60);
  return `${((h + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

// Button that opens the wizard. The wizard itself only renders in the browser,
// so it can pick up answers saved from last time.
export function FixtureWizardLauncher(props: { competitionId: string; teams: string[]; venue: string; existing: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-zinc-500">
          Answer a few questions (season dates, days and times, venue, game length) and Sidelnr builds the whole draw —
          everyone plays everyone, with early and late kick-offs shared fairly. You see it before anything is saved.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent">
          Create fixtures automatically
        </button>
      </div>
    );
  }
  return <FixtureWizard {...props} onClose={() => setOpen(false)} />;
}

function FixtureWizard({
  competitionId,
  teams,
  venue,
  existing,
  onClose,
}: {
  competitionId: string;
  teams: string[];
  venue: string;
  existing: number;
  onClose: () => void;
}) {
  const [s, setS] = useState<DrawSettings>(() => loadSaved(competitionId, venue));
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (patch: Partial<DrawSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    setPreview(null);
    try {
      localStorage.setItem(storageKey(competitionId), JSON.stringify(next));
    } catch {}
  };
  const gameMinutes = s.periods * s.periodMinutes + s.breakMinutes;

  const runPreview = () =>
    start(async () => {
      setPreview(await previewDrawAction(competitionId, s));
    });
  const goTo = (i: number) => {
    setStep(i);
    if (i === STEPS.length - 1) runPreview();
  };
  const generate = () => {
    if (preview?.replacing && !confirm(`Replace the ${preview.replacing} upcoming games that have no result yet?`)) return;
    start(async () => {
      const res = await generateDrawAction(competitionId, s);
      if (res.error) setPreview((p) => (p ? { ...p, errors: [res.error!] } : p));
      else setDone(`${res.count} games created.`);
    });
  };

  if (teams.length < 2) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Add the teams first (Teams card above), then come back here.</p>
        <button type="button" onClick={onClose} className="text-zinc-500 underline">
          Close
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">{done} They’re in the fixtures list below and on every team’s page.</p>
        <button type="button" onClick={onClose} className="text-zinc-500 underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <ol className="flex gap-1">
        {STEPS.map((name, i) => (
          <li key={name} className="flex-1">
            <button
              type="button"
              onClick={() => goTo(i)}
              className={`w-full rounded-lg px-1 py-1.5 text-xs font-medium ${i === step ? "bg-zinc-900 text-white" : i < step ? "bg-zinc-200 text-zinc-700" : "bg-zinc-100 text-zinc-400"}`}
            >
              {name}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>First round</span>
              <input type="date" value={s.start} onChange={(e) => set({ start: e.target.value })} className={field} />
            </label>
            <label className="block">
              <span className={label}>Season ends</span>
              <input type="date" value={s.end} onChange={(e) => set({ end: e.target.value })} className={field} />
            </label>
          </div>
          <div>
            <span className={label}>Breaks (no games)</span>
            <div className="space-y-2">
              {s.breaks.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={b.from}
                    aria-label="Break from"
                    onChange={(e) => set({ breaks: s.breaks.map((x, j) => (j === i ? { ...x, from: e.target.value, to: x.to || e.target.value } : x)) })}
                    className={field}
                  />
                  <span className="text-zinc-400">to</span>
                  <input
                    type="date"
                    value={b.to}
                    aria-label="Break to"
                    onChange={(e) => set({ breaks: s.breaks.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })}
                    className={field}
                  />
                  <button type="button" onClick={() => set({ breaks: s.breaks.filter((_, j) => j !== i) })} className="text-zinc-400 underline">
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set({ breaks: [...s.breaks, { from: "", to: "" }] })} className="text-zinc-600 underline">
                + Add a break (holidays, a single weekend off…)
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>Teams play each other</span>
              <select value={s.meetings} onChange={(e) => set({ meetings: Number(e.target.value) })} className={field}>
                <option value={1}>Once</option>
                <option value={2}>Twice (home &amp; away)</option>
                <option value={3}>3 times</option>
                <option value={4}>4 times</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>Weeks kept for finals</span>
              <select value={s.finalsWeeks} onChange={(e) => set({ finalsWeeks: Number(e.target.value) })} className={field}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            {teams.length} teams{teams.length % 2 ? " — an odd number, so one team has a bye each round" : ""}. One round per week.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <span className={label}>Days games are played</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(([d, name]) => {
                const on = s.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ days: on ? s.days.filter((x) => x !== d) : [...s.days, d] })}
                    className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            {s.days.length > 1 && <p className="mt-1 text-xs text-zinc-500">A round is spread over these days, earliest day first.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>First kick-off from</span>
              <input type="time" value={s.windowStart} onChange={(e) => set({ windowStart: e.target.value })} className={field} />
            </label>
            <label className="block">
              <span className={label}>Last game finished by</span>
              <input type="time" value={s.windowEnd} onChange={(e) => set({ windowEnd: e.target.value })} className={field} />
            </label>
          </div>
          <p className="text-xs text-zinc-500">This is the window for the whole day — kick-off times are worked out from the game length.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["single", "Same venue", "Every game at one ground"],
                ["home", "Home grounds", "Played at the home team’s ground"],
              ] as const
            ).map(([mode, title, text]) => (
              <button
                key={mode}
                type="button"
                onClick={() => set({ venueMode: mode })}
                className={`rounded-xl border px-3 py-2.5 text-left ${s.venueMode === mode ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200"}`}
              >
                <span className="block font-semibold">{title}</span>
                <span className={`block text-xs ${s.venueMode === mode ? "text-white/70" : "text-zinc-500"}`}>{text}</span>
              </button>
            ))}
          </div>
          {s.venueMode === "single" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Venue</span>
                <input value={s.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="Optional" className={field} />
              </label>
              <label className="block">
                <span className={label}>Pitches / courts</span>
                <input value={s.pitches} onChange={(e) => set({ pitches: e.target.value })} placeholder="3 or 1, 2, Main" className={field} />
                <span className="mt-0.5 block text-xs text-zinc-400">How many, or their names</span>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <span className={label}>Each team’s home ground</span>
              {teams.map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate">{t}</span>
                  <input
                    value={s.homeGrounds[t] ?? ""}
                    onChange={(e) => set({ homeGrounds: { ...s.homeGrounds, [t]: e.target.value } })}
                    placeholder="Ground / address"
                    className={field}
                  />
                </label>
              ))}
              <p className="text-xs text-zinc-500">Teams sharing a ground: type it the same way and their games are spread over its pitches.</p>
              <label className="block">
                <span className={label}>Pitches at each ground</span>
                <input type="number" min={1} max={20} value={s.groundPitches} onChange={(e) => set({ groundPitches: Number(e.target.value) })} className={field} />
              </label>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={label}>Played in</span>
              <select value={s.periods} onChange={(e) => set({ periods: Number(e.target.value) })} className={field}>
                <option value={1}>One period</option>
                <option value={2}>Halves</option>
                <option value={3}>Thirds</option>
                <option value={4}>Quarters</option>
              </select>
            </label>
            <label className="block">
              <span className={label}>Minutes each</span>
              <input type="number" min={1} max={120} value={s.periodMinutes} onChange={(e) => set({ periodMinutes: Number(e.target.value) })} className={field} />
            </label>
            <label className="block">
              <span className={label}>{s.periods === 2 ? "Half-time (min)" : "Breaks in total (min)"}</span>
              <input type="number" min={0} max={60} value={s.breakMinutes} onChange={(e) => set({ breakMinutes: Number(e.target.value) })} className={field} />
              <span className="mt-0.5 block text-xs text-zinc-400">During a game</span>
            </label>
            <label className="block">
              <span className={label}>Gap between games (min)</span>
              <input type="number" min={0} max={60} value={s.changeover} onChange={(e) => set({ changeover: Number(e.target.value) })} className={field} />
              <span className="mt-0.5 block text-xs text-zinc-400">Teams off, next teams on</span>
            </label>
          </div>
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-600">
            A game takes {gameMinutes} min. With the gap, a new game starts on each pitch every {gameMinutes + s.changeover} min.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          {pending && !preview && <p className="text-zinc-500">Working out the draw…</p>}
          {preview && (
            <>
              {preview.errors.map((e) => (
                <p key={e} className="rounded-xl bg-red-50 px-3 py-2 text-red-800">
                  {e}
                </p>
              ))}
              {preview.summary && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Rounds" value={preview.summary.rounds} />
                  <Stat label="Games" value={preview.total} />
                  <Stat label="Weeks free" value={preview.summary.weeksAvailable} />
                  <Stat label="Slots a day" value={preview.summary.slotsPerVenueDay} />
                  <Stat label="Games a round" value={preview.summary.gamesPerRound} />
                  <Stat label="Slot (min)" value={preview.summary.slotMinutes} />
                </div>
              )}
              {preview.warnings.map((w) => (
                <p key={w} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                  {w}
                </p>
              ))}
              {preview.keeping > 0 && (
                <p className="text-zinc-500">
                  {preview.keeping} games already played (or with results) are kept; the draw continues after them.
                </p>
              )}
              {preview.sample.map((r) => (
                  <div key={r.round}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Round {r.round}</div>
                    <ul className="space-y-0.5 text-xs text-zinc-700">
                      {r.games.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              {preview.total > 0 && (
                <details>
                  <summary className="cursor-pointer text-zinc-500">Fairness per team</summary>
                  <table className="mt-2 w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-left text-zinc-500">
                        <th className="py-1 font-medium">Team</th>
                        <th className="py-1 text-center font-medium">Games</th>
                        <th className="py-1 text-center font-medium">Home</th>
                        <th className="py-1 text-right font-medium">Avg kick-off</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.balance.map((b) => (
                        <tr key={b.team} className="border-t border-zinc-100">
                          <td className="max-w-32 truncate py-1">{b.team}</td>
                          <td className="py-1 text-center">{b.games}</td>
                          <td className="py-1 text-center">{b.home}</td>
                          <td className="py-1 text-right">{b.avgStart === null ? "—" : clock(b.avgStart)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
              <button
                type="button"
                disabled={pending || preview.errors.length > 0}
                onClick={generate}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30"
              >
                {pending ? "Creating…" : preview.errors.length ? "Fix the above to continue" : `Create ${preview.total} fixtures`}
              </button>
              {existing > 0 && preview.replacing > 0 && (
                <p className="text-xs text-zinc-500">This replaces the {preview.replacing} upcoming games that have no result yet.</p>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
        <button type="button" onClick={step === 0 ? onClose : () => goTo(step - 1)} className="text-zinc-500 underline">
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < STEPS.length - 1 && (
          <button type="button" onClick={() => goTo(step + 1)} className="rounded-xl bg-zinc-900 px-5 py-2 font-semibold text-white">
            {step === STEPS.length - 2 ? "Preview" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-2 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-zinc-500">{label}</div>
    </div>
  );
}
