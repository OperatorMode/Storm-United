"use client";

import { useTransition } from "react";
import { deleteMyAccount, leaveTeamAsManager } from "./actions";

// "Stop managing" a team: the team carries on for its families.
export function StopManaging({ teamId, teamName, owner }: { teamId: string; teamName: string; owner: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(
          `Stop managing ${teamName}? The team carries on for its families${owner ? ", and the next manager becomes its owner" : ""}. You can add it again with its manager PIN.`,
        ) && start(() => leaveTeamAsManager(teamId).then(() => {}))
      }
      className="text-xs text-zinc-500 underline"
    >
      {pending ? "Leaving…" : "Stop managing"}
    </button>
  );
}

// Delete the manager account: email, manager links and sign-in links. Teams and leagues stay.
export function DeleteAccount({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <summary className="cursor-pointer font-semibold">Delete my account</summary>
      <p className="mt-2 text-zinc-600">
        Removes your account ({email}) and takes you off every team and league you manage. The teams and leagues carry on for
        everyone else; if you own a team, its next manager becomes the owner. This can’t be undone.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm(`Delete the account ${email} for good?`) && start(() => deleteMyAccount().then(() => {}))}
        className="mt-3 rounded-xl border border-red-300 px-4 py-2 font-medium text-red-700"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </details>
  );
}
