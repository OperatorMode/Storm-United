"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerEvent, joinEvent, myInviteLink } from "./event-actions";
import { setChildren } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";

/** Joining through an invitation: who's coming (a family or a name), or "we're already on the list". */
export function JoinEvent({ eventId, families }: { eventId: string; families: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-semibold">You’re invited</h2>
        <p className="text-sm text-zinc-500">Tell the organiser who’s answering: your name, or your family’s.</p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await joinEvent(eventId, name);
            if (res.error) return setError(res.error);
            router.refresh();
          });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. The Parkers, or Kate" className={`${field} min-w-0 flex-1`} />
        <button disabled={pending || name.trim().length < 2} className="rounded-xl bg-zinc-900 px-4 font-semibold text-white disabled:opacity-30">
          {pending ? "…" : "Join"}
        </button>
      </form>
      {error && <p className="text-sm text-accent">{error}</p>}
      {families.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600">Already on the list (another phone in your family)?</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {families.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await setChildren(eventId, [f.id], false);
                    if (res && "error" in res && res.error) return setError(res.error);
                    router.refresh();
                  })
                }
                className="rounded-full border border-zinc-300 px-3 py-1"
              >
                {f.name}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500">Your family gets a message to let this phone in.</p>
        </details>
      )}
    </section>
  );
}

const STATUS = [
  { s: "yes", label: "Going", on: "border-emerald-600 bg-emerald-600 text-white" },
  { s: "maybe", label: "Maybe", on: "border-amber-500 bg-amber-500 text-white" },
  { s: "no", label: "Can’t come", on: "border-zinc-800 bg-zinc-800 text-white" },
] as const;

/** Going / Maybe / Can't, with how many adults and kids. */
export function AnswerEvent({
  eventId,
  name,
  current,
  rsvpBy,
}: {
  eventId: string;
  name: string;
  current: { status: "yes" | "maybe" | "no"; adults: number; kids: number } | null;
  rsvpBy: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current?.status ?? null);
  const [adults, setAdults] = useState(current?.adults || 1);
  const [kids, setKids] = useState(current?.kids ?? 0);
  const [saved, setSaved] = useState(!!current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (s: "yes" | "maybe" | "no", a = adults, k = kids) =>
    start(async () => {
      setError(null);
      const res = await answerEvent(eventId, s, a, k);
      if (res.error) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  const stepper = (label: string, value: number, set: (n: number) => void, min: number) => (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" onClick={() => (set(Math.max(min, value - 1)), setSaved(false))} className="size-8 rounded-full border border-zinc-300 text-lg leading-none" aria-label={`Fewer ${label}`}>
          −
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
        <button type="button" onClick={() => (set(Math.min(50, value + 1)), setSaved(false))} className="size-8 rounded-full border border-zinc-300 text-lg leading-none" aria-label={`More ${label}`}>
          +
        </button>
      </span>
    </div>
  );
  return (
    <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-semibold">Are you coming, {name}?</h2>
        {rsvpBy && <p className="text-sm text-zinc-500">Please answer by {rsvpBy}.</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STATUS.map((o) => (
          <button
            key={o.s}
            type="button"
            disabled={pending}
            onClick={() => {
              setStatus(o.s);
              if (o.s === "no") save("no");
              else setSaved(false);
            }}
            aria-pressed={status === o.s}
            className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${status === o.s ? o.on : "border-zinc-300 bg-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {status && status !== "no" && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-sm">
          {stepper("Adults", adults, setAdults, 0)}
          {stepper("Kids", kids, setKids, 0)}
          <button
            type="button"
            disabled={pending || (saved && current?.status === status)}
            onClick={() => save(status)}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {pending ? "Saving…" : saved && current?.status === status ? "Saved" : "Save"}
          </button>
        </div>
      )}
      {saved && status === "no" && <p className="text-sm text-zinc-500">Thanks for letting them know.</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
    </section>
  );
}

/** Pass the invitation on: an organiser's link lets people straight in; a guest's waits for an organiser. */
export function InviteLink({ eventId, eventName, label = "Invite someone" }: { eventId: string; eventName: string; label?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await myInviteLink(eventId);
            if ("error" in res) return setMsg(res.error ?? null);
            const url = `${window.location.origin}${res.path}`;
            const text = `You’re invited to ${eventName}. Tap to see the details and say if you’re coming: ${url}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: eventName, text });
                return;
              }
            } catch {
              return; // cancelled
            }
            try {
              await navigator.clipboard.writeText(text);
              setMsg("Invitation copied. Paste it into a message.");
            } catch {
              setMsg(url);
            }
          })
        }
        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-semibold"
      >
        {label}
      </button>
      {msg && <p className="mt-1 break-all text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
