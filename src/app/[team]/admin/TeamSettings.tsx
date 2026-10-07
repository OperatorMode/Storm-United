"use client";

import { useActionState, useRef, useState } from "react";
import { findTeamSquad, saveTeamSettings, teamSquadFromLink } from "./actions";
import { SquadStatus, useSquadFinder } from "@/components/SquadFinder";
import { RoleField } from "@/components/RoleField";
import { PartsField } from "@/components/PartsField";

export function TeamSettings({
  teamId,
  players,
  hasJoinCode,
  meetMinutes,
  goalieEnabled,
  roleName,
  gameParts,
  partName,
}: {
  teamId: string;
  players: string;
  hasJoinCode: boolean;
  meetMinutes: number;
  goalieEnabled: boolean;
  roleName: string | null;
  gameParts: number;
  partName: string;
}) {
  const [state, action, pending] = useActionState(saveTeamSettings.bind(null, teamId), null);
  const field = "w-full rounded-xl border border-zinc-300 px-3 py-2 text-base";
  const [list, setList] = useState(players);
  const listRef = useRef<HTMLTextAreaElement>(null);
  const squad = useSquadFinder(listRef, setList);
  return (
    <form action={action} className="space-y-4 text-sm">
      <div>
        <label htmlFor="settings-players" className="mb-1 block font-medium">
          Players
        </label>
        <span className="mb-1.5 block text-xs text-zinc-500">
          One per line, first name + last initial (e.g. “Zane B.”). Removing a player keeps their past votes and role
          history.
        </span>
        <div className="mb-2">
          <SquadStatus
            finder={squad}
            onFind={() => squad.find(() => findTeamSquad(teamId))}
            fromLink={(url) => teamSquadFromLink(teamId, url)}
          />
        </div>
        <textarea
          id="settings-players"
          ref={listRef}
          name="players"
          value={list}
          onChange={(e) => setList(e.target.value)}
          rows={Math.max(6, list.split("\n").length + 1)}
          className={field}
        />
      </div>

      <label className="block">
        <span className="mb-1 block font-medium">Join code</span>
        <span className="mb-1.5 block text-xs text-zinc-500">
          {hasJoinCode
            ? "Set. Parents need it once to open the team page. Type a new one to change it."
            : "Not set. Anyone with the link can open the team page."}
        </span>
        <input name="join_code" autoComplete="off" placeholder={hasJoinCode ? "New code (optional)" : "e.g. storm26"} className={field} />
        {hasJoinCode && (
          <span className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" name="clear_join" className="size-4" /> Remove the join code
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block font-medium">Meeting time</span>
        <span className="flex items-center gap-2">
          <input name="meet_minutes" type="number" min={0} max={120} defaultValue={meetMinutes} className="w-20 rounded-xl border border-zinc-300 px-3 py-2 text-base" />
          <span className="text-zinc-600">minutes before kick-off (0 = don’t show)</span>
        </span>
      </label>

      <PartsField count={gameParts} name={partName} />
      <RoleField enabled={goalieEnabled} name={roleName} />

      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Saved.</p>}
    </form>
  );
}
