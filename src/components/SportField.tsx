"use client";

import { useState } from "react";
import { SPORTS, sportOf } from "@/lib/sports";
import { PartsField } from "./PartsField";
import { RoleField } from "./RoleField";

// The team's sport, with how games are split and the special role under it.
// Picking a sport sets those two to its usual ones (they can still be changed).
export function SportField({
  sport,
  gameParts,
  partName,
  goalieEnabled,
  roleName,
  compact = false,
}: {
  sport: string | null;
  gameParts: number;
  partName: string;
  goalieEnabled: boolean;
  roleName: string | null;
  compact?: boolean;
}) {
  const saved = sportOf(sport).id;
  const [id, setId] = useState(saved);
  const s = sportOf(id);
  const mine = id === saved; // the saved settings, or the new sport's usual ones
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={compact ? "mb-1 block text-zinc-600" : "mb-1 block font-medium"}>Sport</span>
        <select name="sport" value={id} onChange={(e) => setId(sportOf(e.target.value).id)} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base">
          {SPORTS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">Sets the field and the scoring in My Game, and the usual game split below.</span>
      </label>
      <PartsField key={`p-${id}`} count={mine ? gameParts : s.parts.count} name={mine ? partName : s.parts.name} />
      <RoleField key={`r-${id}`} enabled={mine ? goalieEnabled : !!s.role} name={mine ? roleName : (s.role ?? roleName)} compact={compact} />
    </div>
  );
}
