"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMyName } from "@/app/profile-actions";

const SKIP_KEY = "su_name_skipped";

// "Who are you?" on the home page: the name used across the app (your answer
// to events, and "Tobi (Brooklyn's Dad)" in your teams). Once set: "Hi, Tobi".
export function WhoAreYou({ name }: { name: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [skipped, setSkipped] = useState(true);
  const [value, setValue] = useState(name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let s = false;
    try {
      s = localStorage.getItem(SKIP_KEY) === "1";
    } catch {}
    queueMicrotask(() => setSkipped(s));
  }, []);

  const save = () =>
    start(async () => {
      setError(null);
      const res = await setMyName(value);
      if (res.error) return setError(res.error);
      setEditing(false);
      router.refresh();
    });

  if (name && !editing) {
    return (
      <p className="text-center text-sm opacity-80">
        Hi, {name} ·{" "}
        <button type="button" onClick={() => setEditing(true)} className="underline">
          Change
        </button>
      </p>
    );
  }
  if (!name && skipped && !editing) return null;

  return (
    <section className="rounded-2xl bg-white p-4 text-zinc-950 shadow-lg">
      <h2 className="font-semibold">{name ? "Your name" : "Who are you?"}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Your first name, so your teams and events know who’s who, e.g. “Tobi (Leo’s Dad)”.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={24}
          autoComplete="given-name"
          placeholder="First name"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-base"
        />
        <button disabled={pending || value.trim().length < 2} className="rounded-xl bg-zinc-900 px-4 font-semibold text-white disabled:opacity-30">
          {pending ? "…" : "Save"}
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-accent">{error}</p>}
      {!name && (
        <button
          type="button"
          onClick={() => {
            setSkipped(true);
            setEditing(false);
            try {
              localStorage.setItem(SKIP_KEY, "1");
            } catch {}
          }}
          className="mt-2 text-xs text-zinc-500 underline"
        >
          Not now
        </button>
      )}
      {name && (
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-xs text-zinc-500 underline">
          Cancel
        </button>
      )}
    </section>
  );
}
