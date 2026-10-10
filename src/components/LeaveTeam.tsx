"use client";

import { useTransition } from "react";
import { leaveTeam } from "@/app/[team]/actions";

// "Leave this team": forgets the team on this phone (code, children picked)
// and stops its notifications here.
export function LeaveTeam({ teamId, teamName, className = "" }: { teamId: string; teamName: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Leave ${teamName} on this phone? It disappears from your home page and My Activities, and its notifications stop. You can join again with the team code.`)) return;
        start(async () => {
          let endpoint: string | null = null;
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            endpoint = (await reg?.pushManager.getSubscription())?.endpoint ?? null;
          } catch {}
          await leaveTeam(teamId, endpoint);
        });
      }}
      className={className}
    >
      {pending ? "Leaving…" : "Leave this team"}
    </button>
  );
}
