"use client";

import { useActionState } from "react";
import { enterJoinCode } from "@/app/[team]/actions";
import { logoSrc } from "@/lib/brand";

// Shown instead of the team page until the team's join code is entered once.
export function JoinGate({ team }: { team: { id: string; name: string; logo_url: string | null } }) {
  const [state, action, pending] = useActionState(enterJoinCode, null);
  return (
    <div className="jersey flex min-h-dvh items-center justify-center p-4">
      <form action={action} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-zinc-950 shadow-xl">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc(team)} alt="" className="size-12 object-contain" />
          <div>
            <div className="font-semibold">{team.name}</div>
            <div className="text-sm text-zinc-500">Enter the team code from your coach.</div>
          </div>
        </div>
        <input type="hidden" name="team" value={team.id} />
        <input
          name="code"
          autoComplete="off"
          autoCapitalize="none"
          placeholder="Team code"
          className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-base"
        />
        <button disabled={pending} className="w-full rounded-xl bg-team px-4 py-3 text-sm font-semibold text-on-team">
          {pending ? "Checking…" : "Continue"}
        </button>
        {state?.error && <p className="text-sm text-accent">{state.error}</p>}
      </form>
    </div>
  );
}
