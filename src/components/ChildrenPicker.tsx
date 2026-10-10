"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useTransition } from "react";
import { setChildren } from "@/app/[team]/actions";
import { LeaveTeam } from "./LeaveTeam";

// Who this phone belongs to: a parent ("Parent of…" one child, or siblings in
// the same team) or, in older teams, the player themselves ("I am…").
// `inline` shows the list straight away (first visit); otherwise it's a small
// button in the header ("Sam & Ella's parent", or "Jo") that opens it.

const first = (name: string) => name.split(" ")[0];

export function familyLabel(names: string[], self = false): string {
  if (!names.length) return "Who are you?";
  if (self) return names[0];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${list}’s parent`;
}

export function ChildrenPicker({
  teamId,
  players,
  current,
  self: savedSelf,
  inline = false,
}: {
  teamId: string;
  players: { id: string; name: string }[];
  current: string[];
  self: boolean;
  inline?: boolean;
}) {
  const [state, setState] = useOptimistic({ chosen: current, self: savedSelf });
  const [pending, start] = useTransition();
  const { chosen, self } = state;
  const menu = useRef<HTMLDetailsElement>(null);

  // Tapping anywhere outside the open list closes it.
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const save = (next: string[], nextSelf: boolean) =>
    start(async () => {
      setState({ chosen: next, self: nextSelf });
      await setChildren(teamId, next, nextSelf);
    });
  // A player is one person: picking a name replaces the last one.
  const toggle = (id: string) =>
    save(self ? (chosen.includes(id) ? [] : [id]) : chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id], self);
  const setMode = (nextSelf: boolean) => nextSelf !== self && save(nextSelf ? chosen.slice(0, 1) : chosen, nextSelf);

  const modes = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-sm">
      {[
        { value: false, label: "Parent of…" },
        { value: true, label: "I am…" },
      ].map((m) => (
        <button
          key={m.label}
          type="button"
          onClick={() => setMode(m.value)}
          aria-pressed={self === m.value}
          className={`rounded-lg px-2 py-1.5 font-medium ${self === m.value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  const list = (
    <div className="grid grid-cols-2 gap-1.5">
      {players.map((p) => {
        const on = chosen.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            aria-pressed={on}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-900"}`}
          >
            <span className={`grid size-4 shrink-0 place-items-center ${self ? "rounded-full" : "rounded"} border text-[10px] ${on ? "border-white" : "border-zinc-400"}`}>
              {on ? "✓" : ""}
            </span>
            <span className="truncate">{first(p.name)}</span>
          </button>
        );
      })}
    </div>
  );

  const hint = self ? "Tap your own name." : "Tick your child, or all of them if you have more than one in this team.";

  if (inline) {
    return (
      <div className="space-y-2">
        {modes}
        {list}
        <p className="text-xs text-zinc-500">
          {hint} This phone remembers it for attendance and votes (
          <Link href="/privacy" className="underline">
            privacy
          </Link>
          ).
        </p>
      </div>
    );
  }

  const names = players.filter((p) => chosen.includes(p.id)).map((p) => first(p.name));
  return (
    <details ref={menu} className="relative">
      <summary className="max-w-44 cursor-pointer list-none truncate rounded-full border border-current/20 bg-current/10 px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        {pending ? "Saving…" : !self && names.length > 1 ? names.join(" & ") : familyLabel(names, self)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-2xl bg-white p-3 text-zinc-950 shadow-xl">
        {modes}
        <p className="text-xs text-zinc-500">{hint}</p>
        {list}
        <LeaveTeam teamId={teamId} teamName="this team" className="mt-1 w-full border-t border-zinc-100 pt-3 text-left text-xs text-red-700 underline" />
      </div>
    </details>
  );
}
