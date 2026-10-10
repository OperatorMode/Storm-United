"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClashTaker, toggleSession } from "./activity-actions";
import { updateAttendance, updateTrainingAttendance } from "@/app/[team]/actions";

export type SkipTarget =
  | { type: "game"; teamId: string; id: string; kidIds: string[] }
  | { type: "training"; teamId: string; id: string; kidIds: string[] }
  | { type: "activity"; activityId: string; start: string };

// The clash solver on a card in My Activities: say the child isn't going (a
// team game or training is marked "Can't make it", an activity skips that
// time), or say who's taking them. Once two things at the same time have
// different people taking them, they stop being a clash.
export function ClashSolver({
  entryKey,
  clash,
  kidNames,
  taker,
  resolved = null,
  options,
  skip,
}: {
  entryKey: string;
  clash: { kind: "child" | "family"; text: string } | null;
  kidNames: string[];
  taker: string | null;
  resolved?: string | null; // a solved clash, and how ("Dad takes Leo, Mum takes Zara")
  options: string[]; // family members to pick from
  skip: SkipTarget | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState("");
  const [typing, setTyping] = useState(false);
  const [pending, start] = useTransition();
  const kids = kidNames.length > 1 ? `${kidNames.slice(0, -1).join(", ")} & ${kidNames.at(-1)}` : (kidNames[0] ?? "them");

  const pick = (who: string | null) =>
    start(async () => {
      await setClashTaker(entryKey, who);
      setOpen(false);
      setTyping(false);
      setOther("");
      router.refresh();
    });
  const notGoing = () =>
    start(async () => {
      if (!skip) return;
      if (skip.type === "activity") await toggleSession(skip.activityId, skip.start);
      else
        for (const kid of skip.kidIds) {
          if (skip.type === "game") await updateAttendance(skip.teamId, skip.id, { status: "no" }, kid);
          else await updateTrainingAttendance(skip.teamId, skip.id, "no", kid);
        }
      setOpen(false);
      router.refresh();
    });

  if (!clash && !taker && !resolved) return null;
  return (
    <div className="mb-2">
      {clash && (
        <div className={`rounded-xl px-3 py-2 text-xs font-medium ${clash.kind === "child" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          <div className="flex items-center justify-between gap-2">
            <span>{clash.text}</span>
            <button type="button" onClick={() => setOpen(!open)} className="shrink-0 rounded-full bg-white px-2.5 py-1 font-semibold text-zinc-900 shadow-sm">
              {open ? "Close" : "Resolve clash"}
            </button>
          </div>
        </div>
      )}
      {!clash && resolved && (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          <div className="flex items-center justify-between gap-2">
            <span>
              <span className="font-semibold">Clash resolved:</span> {resolved}
            </span>
            {taker && (
              <button type="button" onClick={() => setOpen(!open)} className="shrink-0 rounded-full bg-white px-2.5 py-1 font-semibold text-zinc-900 shadow-sm">
                {open ? "Close" : "Change"}
              </button>
            )}
          </div>
        </div>
      )}
      {!clash && !resolved && taker && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">Taken by {taker}</span>
          <button type="button" onClick={() => setOpen(!open)} className="text-zinc-500 underline">
            {open ? "Close" : "Change"}
          </button>
        </div>
      )}
      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-zinc-200 p-3 text-sm">
          {clash?.kind === "child" && <p className="text-xs text-zinc-500">{kids} can’t be in two places at once. Pick the one to skip.</p>}
          {skip && (
            <button type="button" disabled={pending} onClick={notGoing} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-left">
              <span className="block font-medium">Not going</span>
              <span className="block text-xs text-zinc-500">
                {skip.type === "activity" ? "Skip this one, just this time" : `Tells the coach ${kids} can’t make it`}
              </span>
            </button>
          )}
          {clash?.kind !== "child" && (
            <div>
              <span className="mb-1 block font-medium">Who’s taking {kids}?</span>
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={pending}
                    onClick={() => pick(o)}
                    aria-pressed={taker === o}
                    className={`rounded-full border px-3 py-1 text-xs ${taker === o ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}
                  >
                    {kidNames.includes(o) ? `${o} on their own` : o}
                  </button>
                ))}
                <button type="button" onClick={() => setTyping(true)} className="rounded-full border border-dashed border-zinc-400 px-3 py-1 text-xs">
                  + Someone else
                </button>
              </div>
              {typing && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (other.trim()) pick(other.trim());
                  }}
                >
                  <input
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    maxLength={24}
                    autoFocus
                    placeholder="e.g. Grandma, Sam’s Mum"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-base"
                  />
                  <button disabled={pending || !other.trim()} className="rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white disabled:opacity-40">
                    Save
                  </button>
                </form>
              )}
              {taker && (
                <button type="button" disabled={pending} onClick={() => pick(null)} className="mt-2 text-xs text-zinc-500 underline">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
