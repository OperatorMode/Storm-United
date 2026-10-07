"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CompetitionPicker } from "./CompetitionPicker";
import { SquadStatus, useSquadFinder } from "./SquadFinder";
import { drawTeams, findSquadAction } from "@/app/competition-actions";

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

type SaveResult = { error?: string } | null | undefined;

// Used by the super admin (/super) and by managers (self-serve). Actions are
// passed in, so each caller applies its own permissions.
export function TeamForm({
  competitionLabel,
  initial,
  save,
  remove,
  lockCompetition = false,
  allowTaken = false,
  startCompetitionId,
}: {
  competitionLabel: string | null; // the current competition's label (editing)
  initial: TeamFormValues | null; // null = new team
  save: (prev: SaveResult, formData: FormData) => Promise<SaveResult>;
  remove?: () => Promise<unknown>;
  lockCompetition?: boolean; // editing as a manager: competition/draw name are fixed
  allowTaken?: boolean; // super admin: may follow a draw team that's already on Sidelnr (demo teams)
  startCompetitionId?: string; // new team: start in this competition (with competitionLabel)
}) {
  const [state, action, pending] = useActionState(save, null);
  const [competitionId, setCompetitionId] = useState(initial?.competition_id ?? startCompetitionId ?? "");
  const [label, setLabel] = useState(competitionLabel);
  const [leagueName, setLeagueName] = useState(initial?.league_name ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [players, setPlayers] = useState(initial?.players ?? "");
  const playersRef = useRef<HTMLTextAreaElement>(null);
  const squad = useSquadFinder(playersRef, setPlayers);
  const findSquad = (team: string) => {
    if (competitionId && team) squad.find(() => findSquadAction(competitionId, team));
    else squad.reset();
  };
  // The chosen competition's draw: its teams, and which already have a Sidelnr team.
  const [draw, setDraw] = useState<{ id: string; teams: string[]; taken: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!competitionId || lockCompetition) return;
    let live = true;
    drawTeams(competitionId, initial?.id ?? null).then((d) => live && setDraw({ id: competitionId, ...d }));
    return () => {
      live = false;
    };
  }, [competitionId, lockCompetition, initial?.id]);
  const options = draw?.id === competitionId ? draw.teams : [];
  const taken = draw?.id === competitionId ? draw.taken : {};
  const loadingDraw = !!competitionId && draw?.id !== competitionId;

  return (
    <form action={action} className="space-y-4 text-sm">
      {initial && <input type="hidden" name="existing_id" value={initial.id} />}

      {lockCompetition && initial ? (
        <div className="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-600">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Competition</div>
          {competitionLabel ?? "No competition"} · as “{initial.league_name}”
        </div>
      ) : (
      <div className="space-y-3">
        <div>
          <span className="mb-1 block font-medium">Competition</span>
          <CompetitionPicker
            value={competitionId}
            label={label}
            onChange={(id, l) => {
              setCompetitionId(id);
              setLabel(l);
              setLeagueName("");
              squad.reset();
            }}
          />
        </div>
        <label className="block">
          <span className="mb-1 block font-medium">Team (in the draw)</span>
          <select
            name="league_name"
            value={leagueName}
            onChange={(e) => {
              setLeagueName(e.target.value);
              if (!name || name === leagueName) setName(e.target.value);
              findSquad(e.target.value); // fill in the players from the league's website
            }}
            className={field}
            required
          >
            <option value="">{!competitionId ? "Pick the competition first" : loadingDraw ? "Loading the draw…" : "Select…"}</option>
            {options.map((t) => {
              const usedBy = t !== initial?.league_name ? taken[t] : undefined;
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
        <textarea ref={playersRef} name="players" value={players} onChange={(e) => setPlayers(e.target.value)} rows={9} className={field} required />
      </label>
      {(leagueName || initial) && (
        <SquadStatus
          finder={squad}
          onFind={initial?.competition_id ? () => squad.find(() => findSquadAction(initial.competition_id, initial.league_name)) : undefined}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block font-medium">Manager PIN</span>
          <input name="admin_pin" autoComplete="off" placeholder={initial?.hasAdminPin ? "Set (type to change)" : "Optional, for co-coaches"} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Join code</span>
          <input name="join_code" autoComplete="off" placeholder={initial?.hasJoinCode ? "Set (type to change)" : "For parents"} className={field} />
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
