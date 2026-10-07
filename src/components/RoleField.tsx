"use client";

import { useState } from "react";
import { DEFAULT_ROLE } from "@/lib/role";

// "Special team role": a job players sign up for each game (goalie, catcher,
// bowler...). The name box only shows when it's ticked; the name is kept
// either way, so ticking it again brings it back.
export function RoleField({ enabled, name, compact = false }: { enabled: boolean; name: string | null; compact?: boolean }) {
  const [on, setOn] = useState(enabled);
  const [role, setRole] = useState(name ?? DEFAULT_ROLE);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" name="goalie_enabled" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4" />
        <span className={compact ? "text-zinc-600" : "font-medium"}>Special team role</span>
      </label>
      {on ? (
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-500">
            Players sign up for it each game, and Manager’s Corner keeps a fair tally. For example Goalie, Catcher, Bowler.
          </span>
          <input
            name="role_name"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={30}
            placeholder="e.g. Goalie"
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base"
          />
        </label>
      ) : (
        <input type="hidden" name="role_name" value={role} />
      )}
    </div>
  );
}
