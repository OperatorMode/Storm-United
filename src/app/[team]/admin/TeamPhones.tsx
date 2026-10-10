"use client";

import { useTransition } from "react";
import { decidePhone } from "../actions";

export type ChildPhones = {
  id: string;
  name: string;
  phones: { memberId: string; waiting: boolean; device: string; who: string | null; seen: string; self: boolean }[];
};

// Manager's Corner: which phones follow each child. Families let new phones in
// and say "Not us" themselves; this is the fallback for when they can't (a
// lost phone, or nobody in the family has the app yet).
export function TeamPhones({ teamId, kids }: { teamId: string; kids: ChildPhones[] }) {
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {kids.map((c) => (
        <li key={c.id} className="py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{c.name}</span>
            <span className="text-xs text-zinc-500">{c.phones.length ? `${c.phones.length} phone${c.phones.length === 1 ? "" : "s"}` : "No phone yet"}</span>
          </div>
          {c.phones.length > 0 && (
            <ul className="mt-1 space-y-1">
              {c.phones.map((p) => (
                <li key={p.memberId} className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                  <span>
                    {p.who ? `${p.who} · ` : ""}
                    {p.device}
                    {p.self ? " · the player’s own" : ""} · seen {p.seen}
                    {p.waiting && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-amber-900">Waiting for the family</span>}
                  </span>
                  <span className="flex shrink-0 gap-3">
                    {p.waiting && (
                      <button type="button" disabled={pending} onClick={() => start(() => decidePhone(teamId, p.memberId, c.id, true).then(() => {}))} className="underline">
                        Let in
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        confirm(`Take ${c.name} off this ${p.device}? That phone won’t be able to pick ${c.name} again.`) &&
                        start(() => decidePhone(teamId, p.memberId, c.id, false).then(() => {}))
                      }
                      className="text-red-700 underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
