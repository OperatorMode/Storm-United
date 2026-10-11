"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { decideEventGuest, updateEventDetails } from "../event-actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

/** Let a family a guest invited in, or not. */
export function GuestDecision({ eventId, guestId }: { eventId: string; guestId: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => decideEventGuest(eventId, guestId, true).then(() => {}))}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white"
      >
        Let in
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Not this time? They won’t be on the guest list.") && start(() => decideEventGuest(eventId, guestId, false).then(() => {}))}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
      >
        No
      </button>
    </span>
  );
}

type Details = { name: string; host: string; date: string; start: string; end: string; place: string; details: string; rsvpBy: string };

/** Event name, host, when and where, details, reply-by date, and the organiser code. */
export function EventDetailsForm({ eventId, initial }: { eventId: string; initial: Details }) {
  const [state, action, pending] = useActionState(updateEventDetails.bind(null, eventId), null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <EventFields initial={initial} />
      <label className="block">
        <span className="mb-1 block font-medium">New organiser code</span>
        <input name="code" autoComplete="off" placeholder="Leave blank to keep it" className={field} />
      </label>
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
        {pending ? "Saving…" : "Save changes"}
      </button>
      {state?.error && <p className="text-accent">{state.error}</p>}
      {state?.ok && <p className="text-emerald-700">Saved.</p>}
    </form>
  );
}

/** The fields an event has (shared by creating and editing). */
export function EventFields({ initial }: { initial?: Partial<Details> }) {
  // The phone's time zone (not the server's): the times typed are in it.
  const [tz, setTz] = useState("");
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    queueMicrotask(() => setTz(zone));
  }, []);
  return (
    <>
      <input type="hidden" name="tz" value={tz} />
      <label className="block">
        <span className="mb-1 block font-medium">Event</span>
        <input name="name" required maxLength={60} defaultValue={initial?.name} placeholder="e.g. Zoe’s 9th birthday, Rockets breakup" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Hosted by (optional)</span>
        <input name="host" maxLength={40} defaultValue={initial?.host} placeholder="e.g. Kate & Tom" className={field} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 block sm:col-span-1">
          <span className="mb-1 block font-medium">Date</span>
          <input name="date" type="date" required defaultValue={initial?.date} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Starts</span>
          <input name="start" type="time" required defaultValue={initial?.start || "14:00"} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Ends</span>
          <input name="end" type="time" defaultValue={initial?.end} className={field} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block font-medium">Where</span>
        <input name="place" maxLength={120} defaultValue={initial?.place} placeholder="Address, for directions" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Details (optional)</span>
        <textarea name="details" rows={3} maxLength={2000} defaultValue={initial?.details} placeholder="e.g. Bring a swimsuit and a towel. Pizza at 5." className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium">Please answer by (optional)</span>
        <input name="rsvp_by" type="date" defaultValue={initial?.rsvpBy} className={field} />
        <span className="mt-1 block text-xs text-zinc-500">Guests who haven’t answered get one reminder the day before.</span>
      </label>
    </>
  );
}
