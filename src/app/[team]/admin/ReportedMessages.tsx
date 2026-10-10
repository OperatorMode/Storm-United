"use client";

import { useTransition } from "react";
import { resolveDmReport } from "../dm-actions";
import { resolveChatReport } from "../messaging-actions";

// Private messages a family reported: the manager reads it and either removes
// it (it shows as "Message removed by a manager") or keeps it.
export function ReportedMessages({
  teamId,
  reports,
}: {
  teamId: string;
  reports: { id: string; kind: "dm" | "chat"; from: string; reporter: string; body: string; when: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <ul className="space-y-3 text-sm">
      {reports.map((r) => (
        <li key={r.id} className="space-y-2 rounded-xl bg-red-50 p-3">
          <div className="text-xs text-red-900">
            {r.kind === "chat" ? "Team chat" : "Private message"} · from {r.from} · reported by {r.reporter} · {r.when}
          </div>
          <p className="whitespace-pre-wrap break-words">{r.body}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => (r.kind === "chat" ? resolveChatReport : resolveDmReport)(teamId, r.id, true))}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Remove message
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => (r.kind === "chat" ? resolveChatReport : resolveDmReport)(teamId, r.id, false))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs"
            >
              Keep it
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
