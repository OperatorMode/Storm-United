"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { setChildren, setPerson } from "@/app/[team]/actions";
import { LeaveTeam } from "./LeaveTeam";

// Who this phone belongs to in the team: someone who belongs to a player
// ("I belong to…" one child, or siblings, as their Dad, Mum, Friend…) or the
// player themselves ("I am…", one phone per player). `inline` shows the list
// straight away (first visit); otherwise it's a small button in the header
// ("Leo's Dad", or "Jo") that opens it.

const first = (name: string) => name.split(" ")[0];
const RELATIONS = ["Mum", "Dad", "Grandparent", "Aunty", "Uncle", "Friend"];

export function familyLabel(names: string[], self = false): string {
  if (!names.length) return "Who are you?";
  if (self) return names[0];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${list}’s family`;
}

/** "Who are you to Leo?": Dad, Mum, Friend… (or anything typed), and an optional name. */
export function PersonForm({
  teamId,
  kids,
  relation: savedRelation,
  name: savedName,
  onSaved,
}: {
  teamId: string;
  kids: string[];
  relation: string | null;
  name: string | null;
  onSaved?: () => void;
}) {
  const [relation, setRelation] = useState(savedRelation ?? "");
  const [name, setName] = useState(savedName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const who = kids.length === 1 ? kids[0] : kids.length ? `${kids.slice(0, -1).join(", ")} & ${kids[kids.length - 1]}` : "them";
  const changed = relation.trim() !== (savedRelation ?? "") || name.trim() !== (savedName ?? "");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await setPerson(teamId, relation, name);
          if (res.error) return setError(res.error);
          setSaved(true);
          onSaved?.();
        });
      }}
    >
      <div className="text-sm font-medium">Who are you to {who}?</div>
      <div className="flex flex-wrap gap-1.5">
        {RELATIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRelation(r);
              setSaved(false);
            }}
            aria-pressed={relation.trim().toLowerCase() === r.toLowerCase()}
            className={`rounded-full border px-2.5 py-1 text-xs ${relation.trim().toLowerCase() === r.toLowerCase() ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        value={relation}
        onChange={(e) => {
          setRelation(e.target.value);
          setSaved(false);
        }}
        maxLength={24}
        placeholder="Or type it, e.g. Stepdad, Coach’s helper"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base"
      />
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={24}
        placeholder="Your first name (optional)"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base"
      />
      <button
        disabled={pending || !relation.trim() || (!changed && !!savedRelation)}
        className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : saved && !changed ? "Saved" : "Save"}
      </button>
      {error && <p className="text-xs text-accent">{error}</p>}
      <p className="text-xs text-zinc-500">
        The team sees you as “{name.trim() ? `${name.trim()} (${who}’s ${relation.trim() || "…"})` : `${who}’s ${relation.trim() || "…"}`}” in the chat and
        messages.
      </p>
    </form>
  );
}

export function ChildrenPicker({
  teamId,
  players,
  current,
  self: savedSelf,
  label = null,
  relation = null,
  name = null,
  inline = false,
}: {
  teamId: string;
  players: { id: string; name: string }[];
  current: string[];
  self: boolean;
  label?: string | null; // how the team sees this phone ("Leo's Dad"), once known
  relation?: string | null;
  name?: string | null;
  inline?: boolean;
}) {
  const [state, setState] = useOptimistic({ chosen: current, self: savedSelf });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      setState({ chosen: next, self: nextSelf });
      const res = await setChildren(teamId, next, nextSelf);
      if (res?.error) setError(res.error);
    });
  // A player is one person: picking a name replaces the last one.
  const toggle = (id: string) =>
    save(self ? (chosen.includes(id) ? [] : [id]) : chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id], self);
  const setMode = (nextSelf: boolean) => nextSelf !== self && save(nextSelf ? chosen.slice(0, 1) : chosen, nextSelf);

  const modes = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-sm">
      {[
        { value: false, label: "I belong to…" },
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

  const hint = self ? "Tap your own name." : "Tick the player you belong to, or all of them if there’s more than one in this team.";
  const kids = players.filter((p) => chosen.includes(p.id)).map((p) => first(p.name));
  // Once a child is ticked (and saved), say who you are to them.
  const person = !self && kids.length > 0 && chosen.join() === current.join() && (
    <div className="border-t border-zinc-100 pt-3">
      <PersonForm key={current.join()} teamId={teamId} kids={kids} relation={relation} name={name} />
    </div>
  );
  const errorLine = error && <p className="text-xs text-accent">{error}</p>;

  if (inline) {
    return (
      <div className="space-y-2">
        {modes}
        {list}
        {errorLine}
        <p className="text-xs text-zinc-500">
          {hint} This phone remembers it for attendance and votes (
          <Link href="/privacy" className="underline">
            privacy
          </Link>
          ).
        </p>
        {person}
      </div>
    );
  }

  return (
    <details ref={menu} className="relative">
      <summary className="max-w-44 cursor-pointer list-none truncate rounded-full border border-current/20 bg-current/10 px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        {pending ? "Saving…" : self ? familyLabel(kids, true) : (label ?? familyLabel(kids))}
      </summary>
      <div className="absolute right-0 z-20 mt-2 max-h-[75dvh] w-72 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 text-zinc-950 shadow-xl">
        {modes}
        <p className="text-xs text-zinc-500">{hint}</p>
        {list}
        {errorLine}
        {person}
        <LeaveTeam teamId={teamId} teamName="this team" className="mt-1 w-full border-t border-zinc-100 pt-3 text-left text-xs text-red-700 underline" />
      </div>
    </details>
  );
}
