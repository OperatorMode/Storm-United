"use client";

import { useState, useTransition } from "react";
import { syncNowAction } from "./actions";

// Pulls the latest fixtures and results from a linked league's source now
// (they also update on their own).
export function UpdateNow({ competitionId }: { competitionId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await syncNowAction(competitionId);
            setMsg("error" in res ? (res.error ?? null) : `Up to date: ${res.count} games.`);
          })
        }
        className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 font-medium text-zinc-800 disabled:opacity-50"
      >
        {pending ? "Checking the website…" : "Check for updates now"}
      </button>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
