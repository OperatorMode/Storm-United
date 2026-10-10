"use client";

import { useTransition } from "react";
import { leaveTeam } from "@/app/[team]/actions";

// "Leave this team": forgets the team on this phone (code, children picked)
// and stops its notifications here.
// A signed-in manager of the team keeps it under My Team (the confirm says so).
export function LeaveTeam({
  teamId,
  teamName,
  managing = false,
  className = "",
}: {
  teamId: string;
  teamName: string;
  managing?: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const message = managing
          ? `Leave ${teamName} as a parent on this device? Its notifications stop here. You manage this team, so it stays under My Team while you're signed in.`
          : `Leave ${teamName} on this device? It disappears from your home page and My Activities, and its notifications stop. You can join again with the team code.`;
        if (!confirm(message)) return;
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
