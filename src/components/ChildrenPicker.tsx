"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { leaveTeam, setChildren } from "@/app/[team]/actions";

// Which child (or children: siblings in the same team) this phone belongs to.
// `inline` shows the list straight away (first visit); otherwise it's a small
// "Brooklyn & Sven's parent" button in the header that opens the list.

const first = (name: string) => name.split(" ")[0];

export function familyLabel(names: string[]): string {
  if (!names.length) return "Who are you?";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${list}’s parent`;
}

export function ChildrenPicker({
  teamId,
  players,
  current,
  inline = false,
}: {
  teamId: string;
  players: { id: string; name: string }[];
  current: string[];
  inline?: boolean;
}) {
  const [chosen, setChosen] = useOptimistic(current);
  const [pending, start] = useTransition();

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    start(async () => {
      setChosen(next);
      await setChildren(teamId, next);
    });
  };

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
            <span className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] ${on ? "border-white" : "border-zinc-400"}`}>{on ? "✓" : ""}</span>
            <span className="truncate">{first(p.name)}</span>
          </button>
        );
      })}
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-2">
        {list}
        <p className="text-xs text-zinc-500">
          More than one child in this team? Tick them all. This phone remembers it for attendance and votes (
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
    <details className="relative">
      <summary className="max-w-44 cursor-pointer list-none truncate rounded-full border border-current/20 bg-current/10 px-3 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
        {pending ? "Saving…" : names.length > 1 ? names.join(" & ") : familyLabel(names)}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl bg-white p-3 text-zinc-950 shadow-xl">
        <p className="mb-2 text-xs text-zinc-500">Tick your child, or all of them if you have more than one in this team.</p>
        {list}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Leave this team on this phone? It disappears from your home page and My Player, and notifications for it stop. You can join again with the team code.")) return;
            start(async () => {
              let endpoint: string | null = null;
              try {
                const reg = await navigator.serviceWorker?.getRegistration();
                endpoint = (await reg?.pushManager.getSubscription())?.endpoint ?? null;
              } catch {}
              await leaveTeam(teamId, endpoint);
            });
          }}
          className="mt-3 w-full border-t border-zinc-100 pt-3 text-left text-xs text-red-700 underline"
        >
          Leave this team
        </button>
      </div>
    </details>
  );
}
