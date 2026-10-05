"use client";

import { useActionState } from "react";
import { claimTeam } from "./actions";

const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";

export function ClaimTeamForm() {
  const [state, action, pending] = useActionState(claimTeam, null);
  return (
    <form action={action} className="space-y-2">
      <input name="team" defaultValue={state?.team} autoComplete="off" autoCapitalize="none" placeholder="Team code or team name" className={input} />
      <input name="pin" type="password" inputMode="numeric" autoComplete="off" placeholder="Manager PIN" className={input} />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
        {pending ? "Checking…" : "Add team"}
      </button>
      {state?.error && <p className="text-sm text-accent">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700">Added {state.name}.</p>}
    </form>
  );
}
