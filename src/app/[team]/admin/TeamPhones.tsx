"use client";

import { useTransition } from "react";
import { removePhoneChild } from "../actions";

export type ChildPhones = {
  id: string;
  name: string;
  phones: { deviceId: string; device: string; who: string | null; seen: string; self: boolean }[];
};

// Manager's Corner: which phones follow each child. If a phone picked a child
// it shouldn't have, take the child off it (that phone can't pick them again).
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
                <li key={p.deviceId} className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                  <span>
                    {p.who ? `${p.who} · ` : ""}
                    {p.device}
                    {p.self ? " · the player’s own" : ""} · seen {p.seen}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      confirm(`Take ${c.name} off this ${p.device}? That phone won’t be able to pick ${c.name} again.`) &&
                      start(() => removePhoneChild(teamId, p.deviceId, c.id))
                    }
                    className="text-red-700 underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
