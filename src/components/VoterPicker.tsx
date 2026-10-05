"use client";

import { useTransition } from "react";
import { chooseVoter } from "@/app/actions";
import { COACH_ID, PLAYERS } from "@/lib/players";

export function VoterPicker({ current, prominent }: { current: string | null; prominent?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Who are you?"
      value={current ?? ""}
      disabled={pending}
      onChange={(e) => start(() => chooseVoter(e.target.value))}
      className={
        prominent
          ? "w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base"
          : "max-w-40 truncate rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white"
      }
    >
      <option value="" className="text-black">
        {prominent ? "Select your child…" : "Who are you?"}
      </option>
      {PLAYERS.map((p) => (
        <option key={p.id} value={p.id} className="text-black">
          {prominent ? `I'm ${p.name.split(" ")[0]}'s parent` : `${p.name.split(" ")[0]}'s parent`}
        </option>
      ))}
      <option value={COACH_ID} className="text-black">
        Coach
      </option>
    </select>
  );
}
