"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerEvent, answerInvitation, myInviteLink } from "./event-actions";
import { setChildren } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";

/**
 * The invitation: Going / Maybe / Can't come straight away (and how many). The
 * name is this phone's "Who are you?" name, asked here only if it has none.
 */
export function InvitationAnswer({
  eventId,
  needName,
  rsvpBy,
  families,
  family,
}: {
  eventId: string;
  needName: boolean;
  rsvpBy: string | null;
  families: { id: string; name: string }[];
  family: string[]; // this phone's family, for "who's going"
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"yes" | "maybe" | "no" | null>(null);
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (s: "yes" | "maybe" | "no") =>
    start(async () => {
      setError(null);
      const res = await answerInvitation(eventId, s, adults, kids, needName ? name : null, people);
      if (res.error) return setError(res.error);
      router.replace(`/${eventId}?joined`, { scroll: true });
    });
  return (
    <section className="space-y-3 rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">You’re invited. Are you coming?</h2>
        {rsvpBy && <p className="text-sm font-medium text-amber-700">Please answer by {rsvpBy}.</p>}
      </div>
      {needName && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Your first name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" placeholder="So the organiser knows who’s coming" className={field} />
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        {STATUS.map((o) => (
          <button
            key={o.s}
            type="button"
            disabled={pending}
            onClick={() => {
              setStatus(o.s);
              if (o.s === "no") send("no");
            }}
            aria-pressed={status === o.s}
            className={`rounded-xl border px-2 py-3 text-sm font-semibold ${status === o.s ? o.on : "border-zinc-300 bg-white"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {status && status !== "no" && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-sm">
          <WhoGoing family={needName && name.trim() ? [name.trim(), ...family] : family} value={people} set={setPeople} />
          <Stepper label="Adults" value={adults} set={setAdults} />
          <Stepper label="Kids" value={kids} set={setKids} />
          <button type="button" disabled={pending} onClick={() => send(status)} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white">
            {pending ? "Sending…" : "Send my answer"}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
      {families.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">Someone in your family already answered on their phone?</summary>
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
                className="rounded-full border border-zinc-300 px-3 py-1 text-sm text-zinc-800"
              >
                {f.name}
              </button>
            ))}
          </div>
          <p className="mt-1">Pick them: they get a message to let this phone in.</p>
        </details>
      )}
    </section>
  );
}

function Stepper({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <button type="button" onClick={() => set(Math.max(0, value - 1))} className="size-8 rounded-full border border-zinc-300 text-lg leading-none" aria-label={`Fewer ${label.toLowerCase()}`}>
          −
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{value}</span>
        <button type="button" onClick={() => set(Math.min(50, value + 1))} className="size-8 rounded-full border border-zinc-300 text-lg leading-none" aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
      </span>
    </div>
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
  family,
}: {
  eventId: string;
  name: string;
  current: { status: "yes" | "maybe" | "no"; adults: number; kids: number; people: string[] } | null;
  rsvpBy: string | null;
  family: string[]; // this phone's family, for "who's going"
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current?.status ?? null);
  const [adults, setAdults] = useState(current?.adults || 1);
  const [kids, setKids] = useState(current?.kids ?? 0);
  const [people, setPeople] = useState<string[]>(current?.people ?? []);
  const [saved, setSaved] = useState(!!current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (s: "yes" | "maybe" | "no", a = adults, k = kids) =>
    start(async () => {
      setError(null);
      const res = await answerEvent(eventId, s, a, k, people);
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
          <WhoGoing
            family={family}
            value={people}
            set={(f) => {
              setPeople(f);
              setSaved(false);
            }}
          />
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

/** Who from the family is going: each gets their own dot in My Activities. */
function WhoGoing({ family, value, set }: { family: string[]; value: string[]; set: (f: (prev: string[]) => string[]) => void }) {
  const [typing, setTyping] = useState(false);
  const [other, setOther] = useState("");
  const options = [...new Set([...family, ...value])];
  const toggle = (p: string) => set((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const add = () => {
    const p = other.replace(/\s+/g, " ").trim().slice(0, 24);
    if (p) set((prev) => (prev.includes(p) ? prev : [...prev, p]));
    setOther("");
    setTyping(false);
  };
  return (
    <div>
      <div className="mb-1.5 text-xs text-zinc-500">Who from your family? (for your calendar)</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value.includes(p)}
            onClick={() => toggle(p)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${value.includes(p) ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}
          >
            {p}
          </button>
        ))}
        {typing ? (
          <span className="flex gap-1">
            <input
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              maxLength={24}
              placeholder="First name"
              className="w-28 rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm"
            />
            <button type="button" onClick={add} className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white">
              Add
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setTyping(true)} className="rounded-full border border-dashed border-zinc-400 px-3 py-1 text-sm text-zinc-600">
            + Someone else
          </button>
        )}
      </div>
    </div>
  );
}
