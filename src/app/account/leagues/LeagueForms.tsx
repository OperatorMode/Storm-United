"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  addCompetitionAction,
  addEventDivisionAction,
  createEventAction,
  generatePoolsAction,
  setFixtureTeamsAction,
  addFixtureAction,
  addTeamsAction,
  connectFeedAction,
  createLeagueAction,
  disconnectFeedAction,
  previewFeedAction,
  syncNowAction,
  deleteCompetitionAction,
  deleteFixtureAction,
  deleteLeagueAction,
  importFixturesCsv,
  removeTeamAction,
  saveCompetitionSettings,
  saveLeagueTimezone,
  saveResult,
} from "./actions";
import { allTimezones, formatWhen } from "@/lib/time";

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

// `event`: a one-day event's division (its date is kept in `season`).
function CompetitionFields({ initial, event = false }: { initial?: Comp; event?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>{event ? "Division" : "Competition"}</span>
          <input name="competition_name" defaultValue={initial?.name} placeholder="e.g. Under 10s, Open" className={field} required />
        </label>
        {event ? (
          <label className="block">
            <span className={label}>Event date</span>
            <input name="season" type="date" defaultValue={initial?.season ?? ""} className={field} required />
          </label>
        ) : (
          <label className="block">
            <span className={label}>Season</span>
            <input name="season" defaultValue={initial?.season ?? ""} placeholder="e.g. Spring 2026" className={field} />
          </label>
        )}
      </div>
      {event ? (
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
      ) : (
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
      )}
    </>
  );
}

// Every IANA timezone, preselecting the browser's own for a new league. Both
// are read on the client only (they can differ from the server's).
const noSubscribe = () => () => {};
let zoneList: string[] | null = null;
const clientZones = () => (zoneList ??= allTimezones());
const noZones: string[] = [];
function TimezoneSelect({ initial }: { initial?: string }) {
  const zones = useSyncExternalStore(noSubscribe, clientZones, () => noZones);
  const browserTz = useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", () => "");
  const [picked, setPicked] = useState<string | null>(null);
  const value = picked ?? initial ?? browserTz;
  const options = !value || zones.includes(value) ? zones : [value, ...zones];
  return (
    <select name="timezone" value={value} onChange={(e) => setPicked(e.target.value)} className={field} required>
      {options.map((z) => (
        <option key={z} value={z}>
          {z.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

export function LeagueTimezoneForm({ competitionId, initial }: { competitionId: string; initial: string }) {
  const [state, action, pending] = useActionState(saveLeagueTimezone.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <p className="text-zinc-500">Kick-off times are entered and shown in this timezone, for everyone in the league.</p>
      <TimezoneSelect initial={state && "timezone" in state ? state.timezone : initial} />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Saving…" : "Save timezone"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Saved.</p>}
    </form>
  );
}

export function NewLeagueForm({ event = false }: { event?: boolean }) {
  const [state, action, pending] = useActionState(event ? createEventAction : createLeagueAction, null);
  return (
    <form action={action} className="space-y-4 text-sm">
      <label className="block">
        <span className={label}>{event ? "Event name" : "League name"}</span>
        <input
          name="league_name"
          placeholder={event ? "e.g. Summer Gala Day 2026" : "e.g. Saturday Social League 2026"}
          className={field}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Short name</span>
          <input name="short_name" placeholder={event ? "e.g. Gala Day" : "e.g. Saturday Social"} className={field} />
        </label>
        <label className="block">
          <span className={label}>Venue</span>
          <input name="venue" placeholder="Optional" className={field} />
        </label>
      </div>
      <label className="block">
        <span className={label}>{event ? "Event website" : "League website"} (optional)</span>
        <input name="website" type="url" placeholder="https://…" className={field} />
        <span className="mt-1 block text-xs text-zinc-500">
          Shown as a link on team pages. To pull fixtures from a web page, sheet or calendar, use Fixtures → From a link after
          creating it.
        </span>
      </label>
      <label className="block">
        <span className={label}>Timezone</span>
        <TimezoneSelect />
      </label>
      <div className="border-t border-zinc-100 pt-4">
        <p className="mb-3 text-zinc-500">
          {event ? "Your first division" : "Your first competition"} (you can add more, e.g. one per age group):
        </p>
        <div className="space-y-3">
          <CompetitionFields event={event} />
        </div>
      </div>
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
        {pending ? "Creating…" : event ? "Create event" : "Create league"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
    </form>
  );
}

export function AddCompetitionForm({ leagueId, event = false }: { leagueId: string; event?: boolean }) {
  const [state, action, pending] = useActionState((event ? addEventDivisionAction : addCompetitionAction).bind(null, leagueId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <CompetitionFields event={event} />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Adding…" : event ? "Add division" : "Add competition"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
    </form>
  );
}

export function CompetitionSettingsForm({ competitionId, initial, event = false }: { competitionId: string; initial: Comp; event?: boolean }) {
  const [state, action, pending] = useActionState(saveCompetitionSettings.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <CompetitionFields initial={initial} event={event} />
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

export function AddFixtureForm({
  competitionId,
  teams,
  event = false,
  defaultDate,
}: {
  competitionId: string;
  teams: string[];
  event?: boolean;
  defaultDate?: string;
}) {
  const [state, action, pending] = useActionState(addFixtureAction.bind(null, competitionId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      {event && (
        <p className="text-zinc-500">
          For finals, use placeholders like “1st Pool A” or “Winner SF1”, then fill in the real teams once they’re known.
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {event ? (
          <label className="block">
            <span className={label}>Stage</span>
            <input name="stage" list="event-stages" placeholder="Final" className={field} required />
            <datalist id="event-stages">
              {["Quarter-final", "Semi-final", "3rd place", "Final", "Plate final", "Pool A", "Pool B"].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        ) : (
          <label className="block">
            <span className={label}>Round</span>
            <input name="round" type="number" min={1} className={field} />
          </label>
        )}
        <label className="col-span-2 block">
          <span className={label}>Date</span>
          <input name="date" type="date" defaultValue={defaultDate} className={field} required />
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
            <span className={label}>{event ? (side === "home" ? "Team 1" : "Team 2") : side === "home" ? "Home" : "Away"}</span>
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
  teams,
}: {
  competitionId: string;
  fixture: {
    id: string;
    home: string;
    away: string;
    home_score: number | null;
    away_score: number | null;
    status: string;
    pitch: string | null;
    round: number | null;
    stage?: string | null;
  };
  when: string;
  teams?: string[]; // set for event finals games: their teams can be changed
}) {
  const [editingTeams, setEditingTeams] = useState(false);
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
          {fixture.stage ? `${fixture.stage} · ` : fixture.round ? `Rd ${fixture.round} · ` : ""}
          {when}
          {fixture.pitch ? ` · ${/^[a-z]?\d+[a-z]?$/i.test(fixture.pitch) ? `Pitch ${fixture.pitch}` : fixture.pitch}` : ""}
        </span>
        <span className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs">
            <option value="scheduled">On</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {teams && (
            <button type="button" onClick={() => setEditingTeams((v) => !v)} className="text-zinc-500 underline">
              Teams
            </button>
          )}
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
      {editingTeams && teams && (
        <FixtureTeamsForm competitionId={competitionId} fixture={fixture} teams={teams} onDone={() => setEditingTeams(false)} />
      )}
      {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
    </li>
  );
}

function FixtureTeamsForm({
  competitionId,
  fixture,
  teams,
  onDone,
}: {
  competitionId: string;
  fixture: { id: string; home: string; away: string };
  teams: string[];
  onDone: () => void;
}) {
  const [home, setHome] = useState(fixture.home);
  const [away, setAway] = useState(fixture.away);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listId = `teams-${fixture.id}`;
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-zinc-50 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={home} onChange={(e) => setHome(e.target.value)} list={listId} aria-label="Team 1" className={field} />
        <input value={away} onChange={(e) => setAway(e.target.value)} list={listId} aria-label="Team 2" className={field} />
        <datalist id={listId}>
          {teams.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setFixtureTeamsAction(competitionId, fixture.id, home, away);
            if (res.error) setMsg(res.error);
            else onDone();
          })
        }
        className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
      >
        {pending ? "Saving…" : "Save teams"}
      </button>
      {msg && <p className="text-xs text-accent">{msg}</p>}
    </div>
  );
}

// Pools → a round-robin in each, laid out across the pitches.
export function PoolDrawForm({
  competitionId,
  teams,
  defaultDate,
  existingPoolGames,
}: {
  competitionId: string;
  teams: string[];
  defaultDate: string;
  existingPoolGames: number;
}) {
  const [state, action, pending] = useActionState(generatePoolsAction.bind(null, competitionId), null);
  // Controlled, so nothing typed is lost when the form resets after a submit.
  const [pools, setPools] = useState(teams.length ? `Pool A\n${teams.join("\n")}` : "Pool A\n\n\nPool B\n");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("09:00");
  const [slot, setSlot] = useState("20");
  const [pitches, setPitches] = useState("2");
  const [replace, setReplace] = useState(false);
  return (
    <form action={action} className="space-y-3 text-sm">
      <p className="text-zinc-500">
        Type the teams one per line, starting each pool with a heading (“Pool A”, “Pool B”…). Everyone plays everyone in
        their pool; games are spread over the pitches so no team plays twice at once, with a rest between games where
        possible.
      </p>
      <textarea name="pools" value={pools} onChange={(e) => setPools(e.target.value)} rows={10} className={`${field} font-mono text-sm`} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={label}>Date</span>
          <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
        </label>
        <label className="block">
          <span className={label}>First kick-off</span>
          <input name="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={field} required />
        </label>
        <label className="block">
          <span className={label}>Minutes per game</span>
          <input name="slot_minutes" type="number" min={5} max={240} value={slot} onChange={(e) => setSlot(e.target.value)} className={field} />
          <span className="mt-0.5 block text-xs text-zinc-400">Incl. the gap between games</span>
        </label>
        <label className="block">
          <span className={label}>Pitches</span>
          <input name="pitches" value={pitches} onChange={(e) => setPitches(e.target.value)} placeholder="4 or 1, 2, Main" className={field} />
          <span className="mt-0.5 block text-xs text-zinc-400">How many, or their names</span>
        </label>
      </div>
      {existingPoolGames > 0 && (
        <label className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
          <input type="checkbox" name="replace" value="yes" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-1" />
          <span>Replace the existing {existingPoolGames} pool games (results already entered for the same match-ups are kept).</span>
        </label>
      )}
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Building the draw…" : "Build the draw"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && (
        <p className="text-emerald-700">
          {state.count} games scheduled{state.finish ? `, last game ${state.finish}` : ""}.
        </p>
      )}
    </form>
  );
}

const FEED_LABEL = { csv: "Spreadsheet / CSV link", ics: "Calendar (ICS) link", web: "Website (read by AI)" } as const;

export function FeedPanel({
  competitionId,
  connected,
  aiEnabled,
  tz,
}: {
  competitionId: string;
  tz: string;
  connected: { type: "csv" | "ics" | "web"; url: string; filter: string | null; team: string | null; syncedAt: string | null; error: string | null } | null;
  aiEnabled: boolean;
}) {
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
              <span className="text-accent">Couldn’t sync. {connected.error}</span>
            ) : connected.syncedAt ? (
              `Last synced ${formatWhen(connected.syncedAt, tz)}`
            ) : (
              "Not synced yet"
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Re-checked automatically ({connected.type === "web" ? "hourly; the AI only re-reads the page when it changes" : "every 10 minutes"}) whenever
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
      <p className="text-xs text-zinc-500">
        Paste any link that lists the fixtures: the league’s website{aiEnabled ? " (read by AI)" : ""}, a Google Sheet shared as
        “Anyone with the link”, a CSV file or a calendar link. Sidelnr works out which it is. Check the preview before connecting.
      </p>
      <input name="feed_url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={field} />
      <details className="text-xs">
        <summary className="cursor-pointer text-zinc-500">More options</summary>
        <div className="mt-2 space-y-2">
          <input
            name="feed_filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Web page with several competitions? Which one, e.g. “Under 10s”"
            className={field}
          />
          <input name="feed_team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Calendar link? Your team’s name, if titles leave it out" className={field} />
        </div>
      </details>
      <div className="flex gap-2">
        <button formAction={previewAction} disabled={previewing || connecting} className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 font-semibold">
          {previewing ? "Reading the link…" : "Preview"}
        </button>
        <button formAction={connectAction} disabled={previewing || connecting} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
          {connecting ? "Connecting…" : "Connect & import"}
        </button>
      </div>
      {preview && "error" in preview && preview.error && <p className="text-accent">{preview.error}</p>}
      {preview && "preview" in preview && (
        <div className="rounded-xl bg-zinc-50 p-3 text-xs">
          <div className="mb-1 font-semibold">
            Read as {preview.kind}. Found {preview.count} games between {preview.teams} teams. First few:
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

type Impact = { competitions: number; fixtures: number; drawTeams: number; sidelnrTeams: string[] };

// Deleting takes three deliberate steps: see what goes, type the exact name,
// confirm once more. Blocked while Sidelnr teams still use it.
export function DangerZone({
  competitionId,
  competitionName,
  leagueName,
  noun,
  competitionImpact,
  leagueImpact,
}: {
  competitionId: string;
  competitionName: string;
  leagueName: string;
  noun: "league" | "event";
  competitionImpact: Impact;
  leagueImpact: Impact;
}) {
  const [target, setTarget] = useState<"competition" | "league" | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = target === "league" ? leagueName : competitionName;
  const impact = target === "league" ? leagueImpact : competitionImpact;
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  if (!target) {
    return (
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => setTarget("competition")} className="rounded-xl border border-red-200 px-3 py-2 text-red-700">
          Delete “{competitionName}”…
        </button>
        <button type="button" onClick={() => setTarget("league")} className="rounded-xl border border-red-200 px-3 py-2 text-red-700">
          Delete the whole {noun}…
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-xl bg-red-50 p-3 text-red-900">
        <div className="font-semibold">Step 1 · This permanently deletes:</div>
        <ul className="mt-1 list-disc pl-5">
          {target === "league" && <li>the {noun} “{leagueName}” and {plural(impact.competitions, "competition")}</li>}
          {target === "competition" && <li>the competition “{competitionName}”</li>}
          <li>{plural(impact.fixtures, "fixture")} and their results</li>
          <li>{plural(impact.drawTeams, "team")} in the draw</li>
        </ul>
      </div>

      {impact.sidelnrTeams.length > 0 ? (
        <p className="rounded-xl border border-red-200 p-3 text-red-800">
          Can’t delete yet. Sidelnr teams still use it: <b>{impact.sidelnrTeams.join(", ")}</b>. Their managers need to
          move or delete those teams first, so nobody’s team page breaks.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block font-semibold text-red-900">Step 2 · Type “{name}” to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={field} />
          </label>
          <button
            type="button"
            disabled={!matches || pending}
            onClick={() => {
              if (!confirm(`Step 3 · Delete “${name}” forever? This can’t be undone.`)) return;
              start(async () => {
                const res = target === "league" ? await deleteLeagueAction(competitionId, typed) : await deleteCompetitionAction(competitionId, typed);
                if (res?.error) setError(res.error);
              });
            }}
            className="w-full rounded-xl bg-red-700 px-4 py-2.5 font-semibold text-white disabled:opacity-30"
          >
            {pending ? "Deleting…" : "Delete forever"}
          </button>
        </>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <button
        type="button"
        onClick={() => {
          setTarget(null);
          setTyped("");
          setError(null);
        }}
        className="text-zinc-500 underline"
      >
        Cancel
      </button>
    </div>
  );
}
