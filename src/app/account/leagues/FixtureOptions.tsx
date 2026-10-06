"use client";

import { useState, type ReactNode } from "react";

// The ways to add fixtures, grouped under one "Fixtures" heading. Each option
// expands on tap (one at a time); its content only mounts while open.

export type FixtureOption = { key: string; title: string; hint: string; content: ReactNode };

export function FixtureOptions({
  options,
  aside,
  defaultOpen,
}: {
  options: FixtureOption[];
  aside?: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-3 p-4 text-left"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Fixtures</h2>
        <span className="flex items-baseline gap-2 text-xs text-zinc-500">
          {aside}
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
          {options.map((o) => {
            const isOpen = active === o.key;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => setActive(isOpen ? null : o.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="block text-xs text-zinc-500">{o.hint}</span>
                  </span>
                  <Chevron open={isOpen} />
                </button>
                {isOpen && <div className="px-4 pb-4">{o.content}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={`size-4 shrink-0 self-center text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
