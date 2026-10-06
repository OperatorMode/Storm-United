"use client";

import { useState } from "react";

// "Add to calendar": subscribe to the games in the phone's own calendar app.
// The calendar re-reads the link regularly, so changes come through by themselves.
export function AddToCalendar({ host, path, label = "Add games to my calendar" }: { host: string; path: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const https = `https://${host}${path}`;
  const webcal = `webcal://${host}${path}`;
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="text-xs font-normal text-zinc-500">Updates itself</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-xs text-zinc-500">
          Every game appears in your phone’s calendar with the venue, and changes to times or pitches come through on their own.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <a href={webcal} className="rounded-xl bg-zinc-900 px-3 py-2.5 text-center font-semibold text-white">
            iPhone / Apple
          </a>
          <a href={google} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-zinc-900 px-3 py-2.5 text-center font-semibold text-white">
            Google Calendar
          </a>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(https);
              setCopied(true);
            } catch {}
          }}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs"
        >
          {copied ? "Link copied" : "Copy the calendar link (Outlook and others)"}
        </button>
        <p className="text-xs text-zinc-400">Keep this link to yourself: anyone with it can see the game times.</p>
      </div>
    </details>
  );
}
