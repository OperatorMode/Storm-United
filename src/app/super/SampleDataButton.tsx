"use client";

import { useState, useTransition } from "react";
import { fillSampleData } from "./actions";

// For demo teams: one tap fills the team with realistic sample activity.
export function SampleDataButton({ teamId }: { teamId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Add sample attendance, coach posts and chat messages to this team? Use this for demo teams only.")) return;
          start(async () => {
            const res = await fillSampleData(teamId);
            setMsg(res.error ?? "Sample data added — open the team to see it.");
          });
        }}
        className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 font-medium"
      >
        {pending ? "Adding…" : "Fill with sample data (demo teams)"}
      </button>
      {msg && <p className="mt-2 text-zinc-600">{msg}</p>}
    </div>
  );
}
