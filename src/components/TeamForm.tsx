"use client";

import { useActionState, useState } from "react";

export type TeamFormValues = {
  id: string;
  name: string;
  league_name: string;
  competition_id: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  players: string;
  hasAdminPin: boolean;
  hasJoinCode: boolean;
  meet_minutes: number;
  goalie_enabled: boolean;
};

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

export type CompetitionOption = { id: string; league: string; name: string; teams: string[] };

type SaveResult = { error?: string } | null | undefined;

// Used by the super admin (/super) and by managers (self-serve). Actions are
// passed in, so each caller applies its own permissions.
export function TeamForm({
  competitions,
  taken,
  initial,
  save,
  remove,
  lockCompetition = false,
  allowTaken = false,
}: {
  competitions: CompetitionOption[];
  taken: Record<string, string>; // "competitionId|team" -> the Sidelnr team already following it
  initial: TeamFormValues | null; // null = new team
  save: (prev: SaveResult, formData: FormData) => Promise<SaveResult>;
  remove?: () => Promise<unknown>;
  lockCompetition?: boolean; // editing as a manager: competition/draw name are fixed
  allowTaken?: boolean; // super admin: may follow a draw team that's already on Sidelnr (demo teams)
}) {
  const [state, action, pending] = useActionState(save, null);
  const [competitionId, setCompetitionId] = useState(initial?.competition_id ?? competitions[0]?.id ?? "");
  const [leagueName, setLeagueName] = useState(initial?.league_name ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const options = competitions.find((c) => c.id === competitionId)?.teams ?? [];
  const leagues = [...new Set(competitions.map((c) => c.league))];

  return (
    <form action={action} className="space-y-4 text-sm">
      {initial && <input type="hidden" name="existing_id" value={initial.id} />}

      {lockCompetition && initial ? (
        <div className="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-600">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Competition</div>
          {competitions.find((c) => c.id === initial.competition_id)?.league} ·{" "}
          {competitions.find((c) => c.id === initial.competition_id)?.name} · as “{initial.league_name}”
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-medium">Competition</span>
          <select
            name="competition_id"
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value);
              setLeagueName("");
            }}
            className={field}
          >
            {leagues.map((l) => (
              <optgroup key={l} label={l}>
                {competitions
                  .filter((c) => c.league === l)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Team (in the draw)</span>
          <select
            name="league_name"
            value={leagueName}
            onChange={(e) => {
              setLeagueName(e.target.value);
              if (!name || name === leagueName) setName(e.target.value);
            }}
            className={field}
            required
          >
            <option value="">Select…</option>
            {options.map((t) => {
              const usedBy = t !== initial?.league_name ? taken[`${competitionId}|${t}`] : undefined;
              return (
                <option key={t} value={t} disabled={!!usedBy && !allowTaken}>
                  {t}
                  {usedBy ? (allowTaken ? ` (also used by ${usedBy})` : " (already on Sidelnr)") : ""}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      )}

      <label className="block">
        <span className="mb-1 block font-medium">Display name</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} className={field} required />
      </label>

      {!initial && (
        <label className="block">
          <span className="mb-1 block font-medium">Link</span>
          <span className="mb-1.5 block text-xs text-zinc-500">Leave blank to use the display name.</span>
          <span className="flex items-center gap-1 text-zinc-500">
            /<input name="slug" placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className={field} />
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-medium">Main colour</span>
          <input type="color" name="primary_color" defaultValue={initial?.primary_color ?? "#0a0a0a"} className="h-11 w-full rounded-xl border border-zinc-300" />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Accent colour</span>
          <input type="color" name="accent_color" defaultValue={initial?.accent_color ?? "#e5334b"} className="h-11 w-full rounded-xl border border-zinc-300" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-medium">Logo</span>
        <span className="mb-1.5 block text-xs text-zinc-500">
          PNG, JPG or SVG, square works best. {initial?.logo_url ? "Upload a new one to replace it." : "Without one, a crest is generated in the team colours."}
        </span>
        <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml" className="block w-full text-sm" />
        {initial?.logo_url && (
          <span className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" name="remove_logo" className="size-4" /> Remove logo (use the generated crest)
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block font-medium">Players</span>
        <span className="mb-1.5 block text-xs text-zinc-500">One per line, first name + last initial (e.g. “Zane B.”).</span>
        <textarea name="players" defaultValue={initial?.players ?? ""} rows={9} className={field} required />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-medium">Manager PIN</span>
          <input name="admin_pin" autoComplete="off" placeholder={initial?.hasAdminPin ? "Set — type to change" : "Optional, for co-coaches"} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Join code</span>
          <input name="join_code" autoComplete="off" placeholder={initial?.hasJoinCode ? "Set — type to change" : "For parents"} className={field} />
        </label>
      </div>
      {initial?.hasJoinCode && (
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" name="clear_join" className="size-4" /> Remove the join code (anyone with the link can open it)
        </label>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <input name="meet_minutes" type="number" min={0} max={120} defaultValue={initial?.meet_minutes ?? 30} className="w-20 rounded-xl border border-zinc-300 px-3 py-2 text-base" />
          <span className="text-zinc-600">min meet before KO</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="goalie_enabled" defaultChecked={initial?.goalie_enabled ?? true} className="size-4" />
          <span className="text-zinc-600">Goalie sign-up</span>
        </label>
      </div>

      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
        {pending ? "Saving…" : initial ? "Save team" : "Create team"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}

      {initial && remove && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete ${initial.name}? This permanently removes its players, attendance, votes and messages.`)) {
              remove();
            }
          }}
          className="w-full rounded-xl px-4 py-2 text-sm text-red-700"
        >
          Delete team
        </button>
      )}
    </form>
  );
}
