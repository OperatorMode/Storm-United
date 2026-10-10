"use client";

import { useState, useTransition } from "react";
import { sendFeedback } from "./actions";

const KINDS = [
  { id: "idea", label: "Idea" },
  { id: "bug", label: "Bug" },
  { id: "other", label: "Something else" },
] as const;

export function FeedbackForm({ from, initialKind }: { from: string; initialKind: string }) {
  const [kind, setKind] = useState<string>(KINDS.some((k) => k.id === initialKind) ? initialKind : "idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-xl bg-emerald-50 px-3 py-3 text-emerald-800">Thanks, it’s been sent. Every message is read.</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
          className="underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await sendFeedback({ kind, message, email, page: from });
          if (res.error) setError(res.error);
          else setSent(true);
        });
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={`rounded-xl border px-2 py-2 text-sm ${kind === k.id ? "border-zinc-900 bg-zinc-900 font-semibold text-white" : "border-zinc-300"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="font-medium">
          {kind === "bug" ? "What happened? What did you expect?" : kind === "idea" ? "What would help you?" : "Your message"}
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder={
            kind === "bug" ? "e.g. The ladder still showed last week’s scores after Saturday’s game" : "e.g. A reminder to bring the oranges on our duty week"
          }
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Your email</span> <span className="text-zinc-500">(optional, if you’d like a reply)</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="name@example.com"
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-base"
        />
      </label>
      <button
        disabled={pending || !message.trim()}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send"}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
      <p className="text-xs text-zinc-500">We add the page you came from and your phone type, so bugs are easier to find. Nothing else.</p>
    </form>
  );
}
