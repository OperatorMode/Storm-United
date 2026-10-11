"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createEventAction } from "@/app/[team]/event-actions";
import { EventFields } from "@/app/[team]/admin/EventOrganiserClient";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";
const THEMES = [
  ["#0f766e", "#f59e0b"],
  ["#1f3a93", "#ff7a1a"],
  ["#7c3aed", "#facc15"],
  ["#be123c", "#fde68a"],
  ["#0a0a0a", "#e5334b"],
  ["#166534", "#bef264"],
];

export function CreateEventForm({ signedInAs, emailSignIn }: { signedInAs: string | null; emailSignIn: boolean }) {
  const [state, action, pending] = useActionState(createEventAction, null);
  const [theme, setTheme] = useState(0);
  return (
    <form action={action} className="space-y-4 text-sm">
      <EventFields />

      <div>
        <span className="mb-1 block font-medium">Colours</span>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(([a, b], i) => (
            <button
              key={a}
              type="button"
              onClick={() => setTheme(i)}
              aria-pressed={theme === i}
              aria-label={`Colours ${i + 1}`}
              className={`flex size-10 overflow-hidden rounded-full ${theme === i ? "ring-2 ring-zinc-900 ring-offset-2" : ""}`}
            >
              <span className="h-full w-1/2" style={{ background: a }} />
              <span className="h-full w-1/2" style={{ background: b }} />
            </button>
          ))}
        </div>
        <input type="hidden" name="primary" value={THEMES[theme][0]} />
        <input type="hidden" name="accent" value={THEMES[theme][1]} />
      </div>

      <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
        <span className="block font-medium">You’re the organiser</span>
        {signedInAs ? (
          <p className="text-zinc-600">
            It’s saved to your account ({signedInAs}), so it’s safe if you change phones. To share organising, set an organiser
            code (optional):
          </p>
        ) : (
          <>
            {emailSignIn && (
              <p className="text-zinc-600">
                <Link href="/login?next=/event/new" className="font-medium text-zinc-900 underline">
                  Sign in with email first
                </Link>{" "}
                (recommended, no password): your event stays safe if you lose or change your phone, you can open it anywhere,
                and all your events are in one place.
              </p>
            )}
            <p className="text-zinc-600">{emailSignIn ? "Or just set an organiser code:" : "Set an organiser code:"} you’ll need it to manage the event on another phone, and you can give it to co-organisers.</p>
          </>
        )}
        <input name="code" autoComplete="off" minLength={4} required={!signedInAs} placeholder={signedInAs ? "Organiser code (optional)" : "Organiser code, at least 4 characters"} className={field} />
      </div>

      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white">
        {pending ? "Creating…" : "Create event"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
    </form>
  );
}
