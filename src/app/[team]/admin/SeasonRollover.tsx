"use client";

import { useEffect, useState, useTransition } from "react";
import { drawTeamNames, rolloverSeason } from "./actions";
import { CompetitionPicker } from "@/components/CompetitionPicker";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "mb-1 block text-sm font-medium";

// Before the team rolls into a new season, the coach answers three questions:
// which competition, who's playing again, and who's new. Then confirms.
export function SeasonRollover({
  teamId,
  teamName,
  currentLabel,
  currentCompetition,
  currentName,
  players,
}: {
  teamId: string;
  teamName: string;
  currentLabel: string | null;
  currentCompetition: string | null;
  currentName: string;
  players: { id: string; name: string }[];
}) {
  const [step, setStep] = useState<"questions" | "confirm" | "done">("questions");
  const [competition, setCompetition] = useState(currentCompetition ?? "");
  const [compLabel, setCompLabel] = useState(currentLabel ?? "");
  const [name, setName] = useState(currentName);
  const [drawTeams, setDrawTeams] = useState<string[]>([]);
  const [keep, setKeep] = useState<string[]>(players.map((p) => p.id));
  const [newPlayers, setNewPlayers] = useState("");
  // What to take to next season.
  const [take, setTake] = useState({ training: true, duties: true, freshBoard: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Team names in the chosen competition's draw, to pick from.
  useEffect(() => {
    if (!competition) return;
    let live = true;
    drawTeamNames(teamId, competition).then((names) => live && setDrawTeams(names));
    return () => {
      live = false;
    };
  }, [teamId, competition]);

  const added = newPlayers.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
  const leaving = players.filter((p) => !keep.includes(p.id));

  if (step === "done") {
    return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">All set: {teamName} is in its new season. Parents see the new fixtures straight away.</p>;
  }

  if (step === "confirm") {
    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-xl bg-zinc-50 p-3">
          <div className="font-semibold">Check before rolling over</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-700">
            <li>
              Competition: <b>{compLabel}</b>, as “{name}”
            </li>
            <li>{keep.length} players continue</li>
            {leaving.length > 0 && <li>Leaving: {leaving.map((p) => p.name.split(" ")[0]).join(", ")}</li>}
            {added.length > 0 && <li>New: {added.join(", ")}</li>}
            <li>Training times: {take.training ? "kept" : "cleared, add next season’s in Training"}</li>
            <li>Duty roster: {take.duties ? "kept" : "cleared"}</li>
            {take.freshBoard && <li>The Board and team chat start empty</li>}
            <li>This season’s attendance, votes and MVP results are kept as history.</li>
          </ul>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep("questions")} className="rounded-xl border border-zinc-300 px-4 py-2.5">
            Back
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await rolloverSeason(teamId, { competitionId: competition, leagueName: name, keep, newPlayers: added, take });
                if (res.error) setError(res.error);
                else setStep("done");
              })
            }
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white"
          >
            {pending ? "Rolling over…" : "Start the new season"}
          </button>
        </div>
        {error && <p className="text-accent">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <span className={label}>1. Which competition is {teamName} in next season?</span>
        <CompetitionPicker
          name="rollover_competition"
          value={competition}
          label={compLabel}
          onChange={(id, l) => {
            setCompetition(id);
            setCompLabel(l);
          }}
        />
        <span className="mt-0.5 block text-xs text-zinc-500">Not listed? Ask your league to add it, or add it yourself under My League.</span>
      </div>
      <label className="block">
        <span className={label}>Your team’s name in that draw</span>
        <input value={name} onChange={(e) => setName(e.target.value)} list="rollover-draw" className={field} />
        <datalist id="rollover-draw">
          {drawTeams.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <div>
        <span className={label}>2. Who’s playing again?</span>
        <div className="grid grid-cols-2 gap-1.5">
          {players.map((p) => {
            const on = keep.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setKeep(on ? keep.filter((x) => x !== p.id) : [...keep, p.id])}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-500 line-through"}`}
              >
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
        <span className="mt-0.5 block text-xs text-zinc-500">Tap to untick anyone who’s leaving. Their history stays.</span>
      </div>

      <label className="block">
        <span className={label}>3. New players (one per line)</span>
        <textarea value={newPlayers} onChange={(e) => setNewPlayers(e.target.value)} rows={3} placeholder={"e.g. Max R\nNoah T"} className={field} />
      </label>

      <details className="rounded-xl border border-zinc-200 p-3">
        <summary className="cursor-pointer font-medium">4. What to take to next season</summary>
        <div className="mt-2 space-y-2">
          {(
            [
              ["training", "Training times", "Keep the weekly sessions going"],
              ["duties", "Duty roster", "Oranges, first aid and the rest"],
              ["freshBoard", "Start the Board and team chat fresh", "Clears this season’s posts and chat"],
            ] as const
          ).map(([key, title, hint]) => (
            <label key={key} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={take[key]}
                onChange={(e) => setTake({ ...take, [key]: e.target.checked })}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="block font-medium">{title}</span>
                <span className="block text-xs text-zinc-500">{hint}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-zinc-500">
            Always kept: players who continue, families’ phones, team colours, codes and PIN, and this season’s results and MVP
            votes as history.
          </p>
        </div>
      </details>

      <button
        type="button"
        disabled={!competition || !name.trim()}
        onClick={() => {
          setError(null);
          setStep("confirm");
        }}
        className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-30"
      >
        Next: check and confirm
      </button>
    </div>
  );
}
