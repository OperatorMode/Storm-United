"use client";

import { useRef, useState, type RefObject } from "react";
import type { SquadResult } from "@/lib/squad";

// Looking up a team's players on its league's website (see lib/squad.ts).
// The names fill an empty list straight away; a list that already has names
// is only replaced when the coach says so.

type State =
  | { stage: "idle" }
  | { stage: "searching" }
  | { stage: "found"; players: string[]; source: string | null; used: boolean }
  | { stage: "none"; note: string | null };

export function useSquadFinder(list: RefObject<HTMLTextAreaElement | null>, setPlayers: (list: string) => void) {
  const [state, setState] = useState<State>({ stage: "idle" });
  const run = useRef(0);

  const find = async (lookup: () => Promise<SquadResult>) => {
    const mine = ++run.current;
    setState({ stage: "searching" });
    const res = await lookup().catch(() => ({ players: [], source: null, note: "Couldn’t read the league website just now." }));
    if (mine !== run.current) return; // a newer search (or a reset) took over
    if (!res.players.length) return setState({ stage: "none", note: res.note });
    const empty = !list.current?.value.trim();
    if (empty) setPlayers(res.players.join("\n"));
    setState({ stage: "found", players: res.players, source: res.source, used: empty });
  };
  const reset = () => {
    run.current++;
    setState({ stage: "idle" });
  };
  const use = () => {
    if (state.stage !== "found") return;
    setPlayers(state.players.join("\n"));
    setState({ ...state, used: true });
  };
  return { state, find, reset, use };
}

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "the league website";
  } catch {
    return "the league website";
  }
};

export function SquadStatus({
  finder,
  onFind,
}: {
  finder: ReturnType<typeof useSquadFinder>;
  onFind?: () => void; // shows a "Find players" button when given
}) {
  const { state } = finder;
  if (state.stage === "searching") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-zinc-700" aria-live="polite">
        <svg className="size-4 shrink-0 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span>Looking for your squad on the league website. This can take a minute or two.</span>
      </div>
    );
  }
  if (state.stage === "found") {
    return (
      <div className="space-y-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900" aria-live="polite">
        <p>
          Found {state.players.length} players on {host(state.source)}.{" "}
          {state.used ? "Check the names below and fix any that are wrong." : "Your list already has names."}
        </p>
        {!state.used && (
          <button type="button" onClick={finder.use} className="font-semibold underline">
            Replace the list with these {state.players.length}
          </button>
        )}
      </div>
    );
  }
  if (state.stage === "none") {
    return (
      <p className="rounded-xl bg-zinc-50 px-3 py-2 text-zinc-600" aria-live="polite">
        {state.note ?? "No squad list found."} Type the players in below.
      </p>
    );
  }
  return onFind ? (
    <button type="button" onClick={onFind} className="text-sm font-medium text-zinc-700 underline">
      Find players on the league website
    </button>
  ) : null;
}
