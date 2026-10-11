"use client";

import { useState, useTransition } from "react";

// One owner step (delete, take off, reset), asked about first. With `typeName`,
// the name has to be typed to go ahead (for deleting).
export function OwnerButton({
  label,
  question,
  typeName,
  action,
  danger = false,
}: {
  label: string;
  question: string;
  typeName?: string;
  action: () => Promise<{ error?: string; ok?: boolean }>;
  danger?: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (typeName) {
            const typed = prompt(`${question}\n\nType “${typeName}” to go ahead.`);
            if (typed?.trim().toLowerCase() !== typeName.trim().toLowerCase()) return;
          } else if (!confirm(question)) return;
          start(async () => {
            const res = await action();
            setMsg(res.error ?? null);
          });
        }}
        className={`rounded-lg border px-2.5 py-1 text-xs ${danger ? "border-red-300 text-red-700" : "border-zinc-300"}`}
      >
        {pending ? "…" : label}
      </button>
      {msg && <span className="text-xs text-red-700">{msg}</span>}
    </span>
  );
}
