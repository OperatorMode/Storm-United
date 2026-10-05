"use client";

import { useTransition } from "react";
import { addTeamToAccount } from "@/app/account/actions";

export function AddToMyTeams({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => addTeamToAccount(teamId))}
      className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
    >
      {pending ? "Adding…" : `Add ${teamName}`}
    </button>
  );
}
