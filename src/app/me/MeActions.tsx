"use client";

import { useState } from "react";
import { ActivityForm } from "./ActivityForm";
import { JoinCode, ShareActivities } from "./ActivitiesManage";

// The two buttons in the My Activities header: add an activity, and share
// (a code for another phone, or a code from one). Each opens its own panel.
export function MeActions({
  people,
  shareable,
  joinInitial = "",
}: {
  people: string[];
  shareable: { id: string; label: string }[];
  joinInitial?: string; // a code from an invitation link: open Share with it filled in
}) {
  const [open, setOpen] = useState<"add" | "share" | null>(joinInitial ? "share" : null);
  const toggle = (p: "add" | "share") => setOpen(open === p ? null : p);
  const button = (p: "add" | "share", label: string) => (
    <button
      type="button"
      onClick={() => toggle(p)}
      aria-expanded={open === p}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${open === p ? "bg-white text-zinc-900" : p === "add" ? "bg-accent text-on-accent" : "border border-current/30 bg-current/10"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {button("add", "+ Add activity")}
        {button("share", "Share")}
      </div>
      {open && (
        <div className="mt-3 rounded-2xl bg-white p-4 text-zinc-950 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{open === "add" ? "Add an activity" : "Share with another phone"}</h2>
            <button type="button" onClick={() => setOpen(null)} className="text-sm text-zinc-500 underline">
              Close
            </button>
          </div>
          {open === "add" ? (
            <ActivityForm people={people} />
          ) : (
            <div className="space-y-4 text-sm">
              {shareable.length > 0 ? (
                <ShareActivities activities={shareable} />
              ) : (
                <p className="text-zinc-500">Add an activity first, then you can share it.</p>
              )}
              <div className="border-t border-zinc-100 pt-4">
                <JoinCode initial={joinInitial} highlight={!!joinInitial} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
