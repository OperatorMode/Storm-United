"use client";

import { useTransition } from "react";
import { stopRunningLeague } from "./actions";

// "Stop running this league": takes this account off the league's admins. The
// league, its fixtures and its teams carry on.
export function StopRunningLeague({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const [pending, start] = useTransition();
  return (
    <p className="text-center">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm(
            `Stop running ${leagueName}? It leaves My League, and you can’t post to its teams any more. The league, its fixtures and its teams carry on. If nobody else runs it, ask Sidelnr to hand it to someone.`,
          ) && start(async () => {
            await stopRunningLeague(leagueId);
          })
        }
        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-600"
      >
        {pending ? "Leaving…" : "Stop running this league"}
      </button>
    </p>
  );
}
