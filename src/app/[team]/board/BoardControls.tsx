"use client";

import { useActionState, useEffect, useOptimistic, useRef, useTransition } from "react";
import { acknowledge, postAnnouncement, removeAnnouncement } from "../messaging-actions";

export function AnnouncementComposer({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState(postAnnouncement.bind(null, teamId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <label className="mb-2 block text-sm font-medium">New message to all families</label>
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
    return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">✓ Acknowledged</span>;
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
      className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent"
    >
      Got it ✓
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
