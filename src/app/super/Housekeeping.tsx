"use client";

import { useState, useTransition } from "react";
import { runCleanUp } from "./actions";

// Owner page: database size against the free plan, and a clean-up of
// leftover records (never anything people wrote or chose).
export function Housekeeping({
  databaseBytes,
  tables,
  counts,
}: {
  databaseBytes: number | null;
  tables: { name: string; rows: number; bytes: number }[];
  counts: { key: string; label: string; count: number }[];
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const LIMIT = 500 * 1024 * 1024; // Supabase free plan
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  const pct = databaseBytes ? Math.min(100, Math.round((databaseBytes / LIMIT) * 100)) : 0;
  const total = counts.reduce((a, c) => a + c.count, 0);

  return (
    <div className="space-y-4 text-sm">
      {databaseBytes !== null ? (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Database</span>
            <span className="text-zinc-500">
              {mb(databaseBytes)} of 500 MB ({pct}%)
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Free plan limit. Upgrade in Supabase before it reaches about 80%. Supabase’s own setup takes roughly 10 MB of it.
          </p>
          {tables.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-500">Largest tables</summary>
              <ul className="mt-1 space-y-0.5 text-xs text-zinc-600">
                {tables.map((t) => (
                  <li key={t.name} className="flex justify-between gap-2">
                    <span>{t.name}</span>
                    <span>
                      {t.rows} rows · {mb(t.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Database size shows on the live site.</p>
      )}

      <div className="border-t border-zinc-100 pt-3">
        <div className="font-medium">Clean up</div>
        <ul className="mt-1 space-y-1 text-xs text-zinc-600">
          {counts.map((c) => (
            <li key={c.key} className="flex justify-between gap-2">
              <span>{c.label}</span>
              <span className="tabular-nums">{c.count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Only leftovers: messages, attendance, teams and activities are never touched.</p>
        <button
          type="button"
          disabled={pending || total === 0}
          onClick={() =>
            start(async () => {
              const res = await runCleanUp();
              setDone("error" in res ? (res.error ?? "Couldn’t clean up.") : `Removed ${res.removed} old record${res.removed === 1 ? "" : "s"}.`);
            })
          }
          className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-30"
        >
          {pending ? "Cleaning up…" : total ? `Clean up ${total} old record${total === 1 ? "" : "s"}` : "Nothing to clean up"}
        </button>
        {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
      </div>
    </div>
  );
}
