"use client";

import { useState, useTransition } from "react";
import { sendLeagueMessage } from "./actions";

// A league admin writes to the Sidelnr teams in the league: everyone, or the
// team managers only.
export function LeagueMessageForm({
  competitionId,
  competitionName,
  teamsHere,
  teamsInLeague,
  severalCompetitions,
}: {
  competitionId: string;
  competitionName: string;
  teamsHere: number; // Sidelnr teams in this competition
  teamsInLeague: number; // ... and in the whole league
  severalCompetitions: boolean;
}) {
  const [state, setState] = useState<Awaited<ReturnType<typeof sendLeagueMessage>> | null>(null);
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "managers">("all");
  const [scope, setScope] = useState<"competition" | "league">("competition");
  const reach = scope === "league" ? teamsInLeague : teamsHere;
  const sent = state && "ok" in state && state.ok;

  if (!teamsInLeague) {
    return <p className="text-sm text-zinc-500">Once teams join on Sidelnr, you can message them all from here.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          const res = await sendLeagueMessage(competitionId, null, form);
          setState(res);
          if ("ok" in res && res.ok) setBody(""); // keep the text if it didn't go
        });
      }}
      className="space-y-3 text-sm"
    >
      <fieldset className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
        {[
          { value: "all" as const, label: "Everyone" },
          { value: "managers" as const, label: "Team managers" },
        ].map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-lg px-2 py-1.5 text-center font-medium ${audience === o.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
          >
            <input type="radio" name="audience" value={o.value} checked={audience === o.value} onChange={() => setAudience(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-zinc-500">
        {audience === "all"
          ? "Posted on every team’s Board, with a notification to parents, players and managers."
          : "A notification to managers’ phones and an email to each team’s managers. Parents don’t see it."}
      </p>

      {severalCompetitions && (
        <select name="scope" value={scope} onChange={(e) => setScope(e.target.value as "competition" | "league")} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base">
          <option value="competition">Teams in {competitionName}</option>
          <option value="league">Teams in every competition</option>
        </select>
      )}

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        required
        placeholder={audience === "all" ? "e.g. Round 6 is washed out, games move to next Saturday." : "e.g. Team sheets for the finals are due Friday."}
        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base"
      />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30">
        {pending ? "Sending…" : `Send to ${reach} team${reach === 1 ? "" : "s"}`}
      </button>
      {state && "error" in state && state.error && <p className="text-accent">{state.error}</p>}
      {sent && <p className="text-emerald-700">Sent to {state.teams} team{state.teams === 1 ? "" : "s"}.</p>}
    </form>
  );
}
