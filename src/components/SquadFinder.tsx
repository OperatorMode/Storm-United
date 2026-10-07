"use client";

import { useRef, useState, type RefObject } from "react";
import type { SquadResult } from "@/lib/squad";
import { namesFromFile, squadNames } from "@/lib/player-names";

// Looking up a team's players on its league's website (see lib/squad.ts).
// The names fill an empty list straight away; a list that already has names
// is only replaced when the coach says so. If the league's website has no
// squad, the coach can point to a page (their club's roster) or upload a file.

type State =
  | { stage: "idle" }
  | { stage: "searching"; what: string }
  | { stage: "found"; players: string[]; from: string; used: boolean }
  | { stage: "none"; note: string | null };

const host = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "the league website";
  } catch {
    return "the league website";
  }
};

export function useSquadFinder(list: RefObject<HTMLTextAreaElement | null>, setPlayers: (list: string) => void) {
  const [state, setState] = useState<State>({ stage: "idle" });
  const run = useRef(0);

  const deliver = (players: string[], from: string, note: string | null) => {
    if (!players.length) return setState({ stage: "none", note });
    const empty = !list.current?.value.trim();
    if (empty) setPlayers(players.join("\n"));
    setState({ stage: "found", players, from, used: empty });
  };
  const find = async (lookup: () => Promise<SquadResult>, what = "Looking for your squad on the league website. This can take a minute or two.") => {
    const mine = ++run.current;
    setState({ stage: "searching", what });
    const res = await lookup().catch(() => ({ players: [], source: null, note: "Couldn’t read the website just now." }));
    if (mine !== run.current) return; // a newer search (or a reset) took over
    deliver(res.players, host(res.source), res.note);
  };
  const fromFile = async (file: File) => {
    run.current++;
    if (file.size > 512 * 1024) return setState({ stage: "none", note: "That file is too big." });
    const names = squadNames(namesFromFile(await file.text()));
    deliver(names, file.name, "No names found in that file. Use one name per line, or a column called “Name”.");
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
  return { state, find, fromFile, reset, use };
}

export function SquadStatus({
  finder,
  onFind,
  fromLink,
}: {
  finder: ReturnType<typeof useSquadFinder>;
  onFind?: () => void; // shows a "Find players" button when given
  fromLink: (url: string) => Promise<SquadResult>;
}) {
  const { state } = finder;
  if (state.stage === "searching") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-zinc-700" aria-live="polite">
        <svg className="size-4 shrink-0 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span>{state.what}</span>
      </div>
    );
  }
  if (state.stage === "found") {
    return (
      <div className="space-y-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900" aria-live="polite">
        <p>
          Found {state.players.length} players in {state.from}.{" "}
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
      <div className="space-y-3 rounded-xl bg-zinc-50 px-3 py-3 text-zinc-700" aria-live="polite">
        <p>{state.note ?? "No squad list found."}</p>
        <OtherWays finder={finder} fromLink={fromLink} />
        <p className="text-xs text-zinc-500">Or type the players in below.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {onFind && (
        <button type="button" onClick={onFind} className="block text-sm font-medium text-zinc-700 underline">
          Find players on the league website
        </button>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-zinc-700 underline">Add players from a link or a file</summary>
        <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-3">
          <OtherWays finder={finder} fromLink={fromLink} />
        </div>
      </details>
    </div>
  );
}

// Paste a link to a squad page, or upload a CSV / text file of names.
function OtherWays({ finder, fromLink }: { finder: ReturnType<typeof useSquadFinder>; fromLink: (url: string) => Promise<SquadResult> }) {
  const [url, setUrl] = useState("");
  const read = () => url.trim() && finder.find(() => fromLink(url.trim()), "Reading that page. This can take a minute.");
  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-600">From a link (your club’s squad or roster page)</span>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the team form
                read();
              }
            }}
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. myclub.com.au/squad"
            aria-label="Link to the squad page"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base"
          />
          <button type="button" onClick={read} disabled={!url.trim()} className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30">
            Get players
          </button>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">From a file (CSV or text, one name per line)</span>
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) finder.fromFile(file);
            e.target.value = "";
          }}
          className="block w-full text-sm"
        />
      </label>
    </div>
  );
}
