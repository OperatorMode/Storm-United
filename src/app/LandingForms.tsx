"use client";

import { useActionState } from "react";
import { joinTeam, managerSignIn } from "./landing-actions";

const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950";

export function JoinTeamForm() {
  const [state, action, pending] = useActionState(joinTeam, null);
  return (
    <form action={action} className="space-y-3">
      <input name="code" defaultValue={state?.code} autoComplete="off" autoCapitalize="none" placeholder="Team code" className={input} />
      <button disabled={pending} className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent">
        {pending ? "Finding your team…" : "Join team"}
      </button>
      {state?.error && <p className="text-sm text-accent">{state.error}</p>}
    </form>
  );
}

export function ManagerSignInForm() {
  const [state, action, pending] = useActionState(managerSignIn, null);
  return (
    <form action={action} className="space-y-3">
      <input name="team" defaultValue={state?.team} autoComplete="off" autoCapitalize="none" placeholder="Team code or team name" className={input} />
      <input name="pin" type="password" inputMode="numeric" autoComplete="off" placeholder="Manager PIN" className={input} />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
        {pending ? "Checking…" : "Open Manager’s Corner"}
      </button>
      {state?.error && <p className="text-sm text-accent">{state.error}</p>}
    </form>
  );
}
