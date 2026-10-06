"use client";

import { useEffect, useState } from "react";
import { kidKey } from "@/lib/kid-key";

// Each child has a colour in My Player (card stripe, name, calendar dots).
// Colours are set per phone: defaults in order, or picked by the parent.
// Everything coloured carries data-kid="<key>" and uses var(--kid), so the
// server-rendered cards pick colours up from the <style> this renders.

export const PALETTE = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#4b5563"];
const KEY = "su_kid_colours";

export function KidColours({ kids }: { kids: string[] }) {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let saved: Record<string, string> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    } catch {}
    queueMicrotask(() => setPicked(saved));
  }, []);

  const colourOf = (name: string, i: number) => picked[kidKey(name)] ?? PALETTE[i % PALETTE.length];
  const choose = (name: string, colour: string) => {
    const next = { ...picked, [kidKey(name)]: colour };
    setPicked(next);
    setOpen(null);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  };

  const css = kids.map((k, i) => `[data-kid="${kidKey(k)}"]{--kid:${colourOf(k, i)}}`).join("");

  return (
    <>
      <style>{css}</style>
      {kids.length > 1 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {kids.map((k) => (
              <button
                key={k}
                type="button"
                data-kid={kidKey(k)}
                onClick={() => setOpen(open === k ? null : k)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${open === k ? "border-zinc-900" : "border-zinc-200 bg-white"}`}
              >
                <span className="size-3 rounded-full" style={{ background: "var(--kid)" }} />
                {k}
              </button>
            ))}
            <span className="text-xs text-zinc-400">Tap to change a colour</span>
          </div>
          {open && (
            <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use this colour for ${open}`}
                  onClick={() => choose(open, c)}
                  className="size-8 rounded-full ring-offset-2 focus:ring-2"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
