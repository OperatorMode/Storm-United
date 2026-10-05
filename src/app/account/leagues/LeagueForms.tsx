"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addCompetitionAction,
  addFixtureAction,
  addTeamsAction,
  connectFeedAction,
  createLeagueAction,
  disconnectFeedAction,
  previewFeedAction,
  syncNowAction,
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

const FEED_LABEL = { csv: "Spreadsheet / CSV link", ics: "Calendar (ICS) link", web: "Website (read by AI)" } as const;

export function FeedPanel({
  competitionId,
  connected,
  aiEnabled,
}: {
  competitionId: string;
  connected: { type: "csv" | "ics" | "web"; url: string; filter: string | null; team: string | null; syncedAt: string | null; error: string | null } | null;
  aiEnabled: boolean;
}) {
  const [type, setType] = useState<"csv" | "ics" | "web">(connected?.type ?? "csv");
  // Controlled so the values survive Preview (forms reset after each action).
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState("");
  const [team, setTeam] = useState("");
  const [preview, previewAction, previewing] = useActionState(previewFeedAction.bind(null, competitionId), null);
  const [connectState, connectAction, connecting] = useActionState(connectFeedAction.bind(null, competitionId), null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (connected) {
    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-xl bg-zinc-50 px-3 py-2">
          <div className="font-medium">{FEED_LABEL[connected.type]}</div>
          <div className="truncate text-xs text-zinc-500">{connected.url}</div>
          {connected.filter && <div className="text-xs text-zinc-500">Competition on page: {connected.filter}</div>}
          <div className="mt-1 text-xs text-zinc-500">
            {connected.error ? (
              <span className="text-accent">Last sync failed: {connected.error}</span>
            ) : connected.syncedAt ? (
              `Last synced ${new Date(connected.syncedAt).toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" })}`
            ) : (
              "Not synced yet"
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Re-checked automatically ({connected.type === "web" ? "hourly — the AI only re-reads the page when it changes" : "every 10 minutes"}) whenever
          someone opens a team page. Results from the link update the ladder; you can still enter scores here.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await syncNowAction(competitionId);
                setMsg("error" in res ? (res.error ?? null) : `Synced ${res.count} fixtures.`);
              })
            }
            className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 font-semibold text-white"
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => confirm("Disconnect this link? Fixtures already imported stay.") && start(() => disconnectFeedAction(competitionId))}
            className="rounded-xl border border-zinc-300 px-4 py-2"
          >
            Disconnect
          </button>
        </div>
        {msg && <p className="text-xs text-zinc-600">{msg}</p>}
      </div>
    );
  }

  return (
    <form className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2">
        {(["csv", "ics", "web"] as const).map((t) => (
          <label
            key={t}
            className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-xs font-medium ${type === t ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"} ${t === "web" && !aiEnabled ? "opacity-40" : ""}`}
          >
            <input type="radio" name="feed_type" value={t} checked={type === t} onChange={() => setType(t)} disabled={t === "web" && !aiEnabled} className="sr-only" />
            {t === "csv" ? "Sheet / CSV" : t === "ics" ? "Calendar" : "Website (AI)"}
          </label>
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        {type === "csv" &&
          "A link to a CSV file, or a Google Sheet shared as “Anyone with the link can view”. Same columns as the upload template."}
        {type === "ics" && "A calendar link (ics/webcal) — e.g. a team’s fixture calendar export. Event titles like “Sharks vs Tigers”."}
        {type === "web" && "Any page that lists the fixtures or results — Claude reads it and turns it into fixtures. Check the preview before connecting."}
      </p>
      <input name="feed_url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={field} />
      {type === "web" && (
        <input name="feed_filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Which competition on that page? e.g. “Under 10s” (optional)" className={field} />
      )}
      {type === "ics" && <input name="feed_team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Your team’s name (if titles don’t include it)" className={field} />}
      <div className="flex gap-2">
        <button formAction={previewAction} disabled={previewing || connecting} className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 font-semibold">
          {previewing ? (type === "web" ? "Reading page…" : "Checking…") : "Preview"}
        </button>
        <button formAction={connectAction} disabled={previewing || connecting} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
          {connecting ? "Connecting…" : "Connect & import"}
        </button>
      </div>
      {preview && "error" in preview && preview.error && <p className="text-accent">{preview.error}</p>}
      {preview && "preview" in preview && (
        <div className="rounded-xl bg-zinc-50 p-3 text-xs">
          <div className="mb-1 font-semibold">
            Found {preview.count} games between {preview.teams} teams. First few:
          </div>
          <ul className="space-y-0.5 text-zinc-600">
            {(preview.sample ?? []).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {(preview.errors ?? []).length > 0 && <p className="mt-2 text-amber-800">{(preview.errors ?? []).slice(0, 3).join(" ")}</p>}
        </div>
      )}
      {connectState?.error && <p className="text-accent">{connectState.error}</p>}
    </form>
  );
}
