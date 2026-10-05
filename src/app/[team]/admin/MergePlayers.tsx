"use client";

import { useState, useTransition } from "react";
import { mergeRemovedPlayer } from "./actions";

type Removed = { id: string; name: string; summary: string };

// Removed players who still have history, each with a "merge into" picker.
export function MergePlayers({
  teamId,
  removed,
  current,
}: {
  teamId: string;
  removed: Removed[];
  current: { id: string; name: string }[];
}) {
  return (
    <ul className="space-y-4">
      {removed.map((r) => (
        <MergeRow key={r.id} teamId={teamId} removed={r} current={current} />
      ))}
    </ul>
  );
}

function MergeRow({ teamId, removed, current }: { teamId: string; removed: Removed; current: { id: string; name: string }[] }) {
  const guess = current.find((c) => c.name.split(" ")[0].toLowerCase() === removed.name.split(" ")[0].toLowerCase());
  const [to, setTo] = useState(guess?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const target = current.find((c) => c.id === to);

  return (
    <li className="text-sm">
      <div className="font-medium">{removed.name}</div>
      <div className="mb-1.5 text-xs text-zinc-500">{removed.summary}</div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-zinc-500">→</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5">
          <option value="">Merge into…</option>
          {current.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!to || pending}
          onClick={() => {
            if (!confirm(`Move all of ${removed.name}’s history to ${target?.name} and remove ${removed.name}?`)) return;
            start(async () => {
              const res = await mergeRemovedPlayer(teamId, removed.id, to);
              setMsg(res.error ?? null);
            });
          }}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
        >
          {pending ? "Merging…" : "Merge"}
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-accent">{msg}</p>}
    </li>
  );
}
