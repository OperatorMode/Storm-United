"use client";

import { useEffect, useState } from "react";
import { searchCompetitions, type CompetitionHit } from "@/app/competition-actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

// Type to find a competition (league, age group, season or venue), then pick
// it. Submits as a hidden `name` input; `onChange` gets the chosen id.
export function CompetitionPicker({
  name = "competition_id",
  value,
  label,
  onChange,
}: {
  name?: string;
  value: string;
  label: string | null; // the chosen competition's label
  onChange: (id: string, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CompetitionHit[]>([]);
  const [searching, setSearching] = useState(!value);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      searchCompetitions(query).then((r) => live && setHits(r));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);
  const shown = query.trim().length < 2 ? [] : hits;

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      {value && !searching ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2">
          <span className="min-w-0 truncate">{label ?? value}</span>
          <button type="button" onClick={() => setSearching(true)} className="shrink-0 text-xs text-zinc-500 underline">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: league, age group, season…"
            className={field}
            autoComplete="off"
            aria-label="Search competitions"
          />
          {shown.length > 0 && (
            <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
              {shown.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(h.id, h.label);
                      setSearching(false);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-zinc-50"
                  >
                    <span className="block text-sm font-medium">{h.label}</span>
                    {h.detail && <span className="block text-xs text-zinc-500">{h.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && !shown.length && <p className="mt-1 text-xs text-zinc-500">No matches yet. Try fewer words.</p>}
          {value && (
            <button type="button" onClick={() => setSearching(false)} className="mt-1 text-xs text-zinc-500 underline">
              Keep {label ?? "the current one"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
