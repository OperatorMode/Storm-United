"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addCompetitionAction,
  addFixtureAction,
  addTeamsAction,
  createLeagueAction,
  deleteFixtureAction,
  importFixturesCsv,
  removeTeamAction,
  saveCompetitionSettings,
  saveResult,
} from "./actions";

export const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const label = "mb-1 block text-sm font-medium";

type Comp = {
  name: string;
  season: string | null;
  points_win: number;
  points_draw: number;
  ladder_last_round: number | null;
  finals_date: string | null;
  finals_note: string | null;
};

function CompetitionFields({ initial }: { initial?: Comp }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Competition</span>
          <input name="competition_name" defaultValue={initial?.name} placeholder="e.g. Under 10s, Open" className={field} required />
        </label>
        <label className="block">
          <span className={label}>Season</span>
          <input name="season" defaultValue={initial?.season ?? ""} placeholder="e.g. Spring 2026" className={field} />
        </label>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-zinc-500">Ladder &amp; finals options</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Points for a win</span>
              <input name="points_win" type="number" min={0} max={10} defaultValue={initial?.points_win ?? 3} className={field} />
            </label>
            <label className="block">
              <span className={label}>Points for a draw</span>
              <input name="points_draw" type="number" min={0} max={10} defaultValue={initial?.points_draw ?? 1} className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Last ladder round</span>
              <input name="ladder_last_round" type="number" min={1} defaultValue={initial?.ladder_last_round ?? ""} placeholder="All rounds" className={field} />
            </label>
            <label className="block">
              <span className={label}>Finals date</span>
              <input name="finals_date" type="date" defaultValue={initial?.finals_date ?? ""} className={field} />
            </label>
          </div>
          <label className="block">
            <span className={label}>Finals note</span>
            <input name="finals_note" defaultValue={initial?.finals_note ?? ""} placeholder="e.g. Top two play the grand final." className={field} />
          </label>
        </div>
      </details>
    </>
  );
}

export function NewLeagueForm() {
  const [state, action, pending] = useActionState(createLeagueAction, null);
  return (
    <form action={action} className="space-y-4 text-sm">
      <label className="block">
        <span className={label}>League name</span>
        <input name="league_name" placeholder="e.g. Saturday Social League 2026" className={field} required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Short name</span>
          <input name="short_name" placeholder="e.g. Saturday Social" className={field} />
        </label>
        <label className="block">
          <span className={label}>Venue</span>
          <input name="venue" placeholder="Optional" className={field} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Website</span>
        <input name="website" type="url" placeholder="Optional, https://…" className={field} />
      </label>
      <div className="border-t border-zinc-100 pt-4">
        <p className="mb-3 text-zinc-500">Your first competition (you can add more, e.g. one per age group):</p>
        <div className="space-y-3">
          <CompetitionFields />
        </div>
      </div>
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
        {pending ? "Creating…" : "Create league"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
    </form>
  );
}

export function AddCompetitionForm({ leagueId }: { leagueId: string }) {
  const [state, action, pending] = useActionState(addCompetitionAction.bind(null, leagueId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <CompetitionFields />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Adding…" : "Add competition"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
    </form>
  );
}

export function CompetitionSettingsForm({ competitionId, initial }: { competitionId: string; initial: Comp }) {
  const [state, action, pending] = useActionState(saveCompetitionSettings.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <CompetitionFields initial={initial} />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Saved.</p>}
    </form>
  );
}

export function TeamsEditor({ competitionId, teams }: { competitionId: string; teams: string[] }) {
  const [state, action, pending] = useActionState(addTeamsAction.bind(null, competitionId), null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <div className="space-y-3 text-sm">
      {teams.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <li key={t} className="flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() =>
                  start(async () => {
                    const res = await removeTeamAction(competitionId, t);
                    setMsg(res?.error ?? null);
                  })
                }
                className="grid size-5 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-accent">{msg}</p>}
      <form ref={form} action={action} className="space-y-2">
        <textarea name="teams" rows={3} placeholder={"Add teams, one per line"} className={field} />
        <button disabled={pending} className="rounded-xl bg-zinc-900 px-4 py-2 font-semibold text-white">
          {pending ? "Adding…" : "Add teams"}
        </button>
      </form>
    </div>
  );
}

export function AddFixtureForm({ competitionId, teams }: { competitionId: string; teams: string[] }) {
  const [state, action, pending] = useActionState(addFixtureAction.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className={label}>Round</span>
          <input name="round" type="number" min={1} className={field} />
        </label>
        <label className="col-span-2 block">
          <span className={label}>Date</span>
          <input name="date" type="date" className={field} required />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={label}>Kick-off</span>
          <input name="time" type="time" className={field} required />
        </label>
        <label className="block">
          <span className={label}>Pitch / field</span>
          <input name="pitch" className={field} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["home", "away"] as const).map((side) => (
          <label key={side} className="block">
            <span className={label}>{side === "home" ? "Home" : "Away"}</span>
            <input name={side} list="competition-teams" className={field} required />
          </label>
        ))}
        <datalist id="competition-teams">
          {teams.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Adding…" : "Add fixture"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Fixture added.</p>}
    </form>
  );
}

export function ImportCsvForm({ competitionId }: { competitionId: string }) {
  const [state, action, pending] = useActionState(importFixturesCsv.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <p className="text-zinc-500">
        Columns: <b>Round, Date, Time, Pitch, Home, Away</b> (+ optional Home score, Away score). Re-importing updates
        matching games and keeps their attendance and votes.{" "}
        <a href="/fixtures-template.csv" download className="font-medium text-zinc-900 underline">
          Download the template
        </a>
        .
      </p>
      <input type="file" name="file" accept=".csv,text/csv" className="block w-full text-sm" />
      <details>
        <summary className="cursor-pointer text-zinc-500">…or paste from a spreadsheet</summary>
        <textarea name="pasted" rows={5} placeholder={"Round,Date,Time,Pitch,Home,Away\n1,12/10/2026,5:45 pm,2,Sharks,Tigers"} className={`${field} mt-2 font-mono text-xs`} />
      </details>
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Importing…" : "Import fixtures"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Imported {state.count} fixtures.</p>}
      {state?.errors && state.errors.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-amber-800">
          {state.errors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {state.errors.length > 8 && <li>…and {state.errors.length - 8} more</li>}
        </ul>
      )}
    </form>
  );
}

export function ResultRow({
  competitionId,
  fixture,
  when,
}: {
  competitionId: string;
  fixture: { id: string; home: string; away: string; home_score: number | null; away_score: number | null; status: string; pitch: string | null; round: number | null };
  when: string;
}) {
  const [h, setH] = useState(fixture.home_score?.toString() ?? "");
  const [a, setA] = useState(fixture.away_score?.toString() ?? "");
  const [status, setStatus] = useState(fixture.status as "scheduled" | "postponed" | "cancelled");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = h !== (fixture.home_score?.toString() ?? "") || a !== (fixture.away_score?.toString() ?? "") || status !== fixture.status;
  const box = "w-11 rounded-lg border border-zinc-300 px-1 py-1.5 text-center text-base tabular-nums";
  return (
    <li className="py-2.5 text-sm">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {fixture.round ? `Rd ${fixture.round} · ` : ""}
          {when}
          {fixture.pitch ? ` · Pitch ${fixture.pitch}` : ""}
        </span>
        <span className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs">
            <option value="scheduled">On</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            type="button"
            onClick={() => confirm("Delete this game?") && start(() => deleteFixtureAction(competitionId, fixture.id))}
            className="text-zinc-400 underline"
          >
            Delete
          </button>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-right font-medium">{fixture.home}</span>
        <input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" aria-label={`${fixture.home} score`} className={box} />
        <input value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" aria-label={`${fixture.away} score`} className={box} />
        <span className="min-w-0 flex-1 truncate font-medium">{fixture.away}</span>
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const res = await saveResult(competitionId, fixture.id, h, a, status);
              setMsg(res.error ?? null);
            })
          }
          className="rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
        >
          {pending ? "…" : "Save"}
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
    </li>
  );
}
