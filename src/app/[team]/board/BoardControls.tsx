"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { acknowledge, postAnnouncement, removeAnnouncement } from "../messaging-actions";
import { pushEndpoint } from "@/lib/push-endpoint";

export function AnnouncementComposer({ teamId, audience = "all families" }: { teamId: string; audience?: string }) {
  const [state, action, pending] = useActionState(postAnnouncement.bind(null, teamId), null);
  const form = useRef<HTMLFormElement>(null);
  const [endpoint, setEndpoint] = useState("");
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  // This phone's push address, so it isn't notified of its own post.
  useEffect(() => {
    pushEndpoint().then((e) => setEndpoint(e ?? ""));
  }, []);
  return (
    <form ref={form} action={action} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="from_endpoint" value={endpoint} />
      <label className="mb-2 block text-sm font-medium">New message to {audience}</label>
      <textarea
        name="body"
        rows={3}
        maxLength={2000}
        placeholder="e.g. No training this Thursday. See you Monday at 5:15!"
        className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-base"
      />
      <button disabled={pending} className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white">
        {pending ? "Posting…" : "Post & notify"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-accent">{state.error}</p>}
    </form>
  );
}

export function AckButton({ teamId, id, done }: { teamId: string; id: string; done: boolean }) {
  const [acked, setAcked] = useOptimistic(done);
  const [, start] = useTransition();
  if (acked) {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
        <span className="grid size-5 place-items-center rounded-md bg-emerald-600 text-xs text-white" aria-hidden>
          ✓
        </span>
        Got it, thanks
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          setAcked(true);
          await acknowledge(teamId, id);
        })
      }
      // Green like a confirmation, with an empty box to tick, whatever the team's colours.
      className="inline-flex items-center gap-2 rounded-xl border-2 border-emerald-700 bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md transition active:translate-y-px active:shadow-sm"
    >
      <span className="size-4 shrink-0 rounded border-2 border-white bg-white/10" aria-hidden />
      Tap to say: Got it
    </button>
  );
}

export function DeleteAnnouncement({ teamId, id }: { teamId: string; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this message for everyone?")) start(() => removeAnnouncement(teamId, id));
      }}
      className="text-zinc-400 underline"
    >
      Delete
    </button>
  );
}
