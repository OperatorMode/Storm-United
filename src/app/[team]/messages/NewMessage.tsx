"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startDm } from "../dm-actions";

// Start a conversation: one family (or the coach), or several for a group,
// which can have a name ("Carpool Saturday").
export function NewMessage({ teamId, families }: { teamId: string; families: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = families.filter((f) => f.label.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
        + New message
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">New message</span>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 underline">
          Cancel
        </button>
      </div>
      {families.length > 8 && (
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base" />
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {shown.map((f) => (
          <li key={f.id}>
            <label className="flex items-center gap-2 rounded-lg px-1 py-1.5">
              <input type="checkbox" checked={chosen.includes(f.id)} onChange={() => toggle(f.id)} className="size-4 accent-zinc-900" />
              {f.label}
            </label>
          </li>
        ))}
      </ul>
      {chosen.length > 1 && (
        <label className="block">
          <span className="mb-1 block font-medium">Group name (optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Carpool Saturday" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base" />
        </label>
      )}
      <button
        type="button"
        disabled={pending || !chosen.length}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startDm(teamId, chosen, name || null);
            if ("error" in res) return setError(res.error ?? null);
            router.push(`/${teamId}/messages/${res.id}`);
          })
        }
        className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-30"
      >
        {chosen.length > 1 ? `Start group (${chosen.length + 1})` : "Start"}
      </button>
      {error && <p className="text-accent">{error}</p>}
    </div>
  );
}
