"use client";

import { useState, useTransition } from "react";
import { ownerSetLinks } from "./actions";

// Developer page: a league read from its website has separate links for its
// fixtures and its ladder (often different pages). Saving reads them again.
export function LeagueLinks({ competitions }: { competitions: { id: string; name: string; feedUrl: string; ladderUrl: string }[] }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-zinc-600 underline">Change links</summary>
      <div className="mt-2 space-y-3">
        {competitions.map((c) => (
          <LinkForm key={c.id} c={c} showName={competitions.length > 1} />
        ))}
      </div>
    </details>
  );
}

function LinkForm({ c, showName }: { c: { id: string; name: string; feedUrl: string; ladderUrl: string }; showName: boolean }) {
  const [fixtures, setFixtures] = useState(c.feedUrl);
  const [ladder, setLadder] = useState(c.ladderUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = "w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm("Save these links and read the league again now? It can take a minute or two.")) return;
        start(async () => {
          setMsg(null);
          const res = await ownerSetLinks(c.id, fixtures, ladder);
          setMsg(res.error ?? `Read again: ${res.games} games.`);
        });
      }}
      className="space-y-1.5 rounded-lg bg-white p-2"
    >
      {showName && <div className="font-medium">{c.name}</div>}
      <label className="block">
        <span className="text-zinc-500">Fixtures</span>
        <input value={fixtures} onChange={(e) => setFixtures(e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-zinc-500">Ladder (optional)</span>
        <input value={ladder} onChange={(e) => setLadder(e.target.value)} className={field} />
      </label>
      <button disabled={pending} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white disabled:opacity-40">
        {pending ? "Reading…" : "Save and read again"}
      </button>
      {msg && <p className="text-zinc-600">{msg}</p>}
    </form>
  );
}
