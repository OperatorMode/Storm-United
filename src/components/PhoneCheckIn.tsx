"use client";

import { useEffect } from "react";
import { checkInPhone } from "@/app/[team]/actions";

const DAY = 24 * 3600_000;

// Tells the team (at most once a day) which children this phone follows, so
// managers can see who's connected. Nothing on screen.
export function PhoneCheckIn({ teamId }: { teamId: string }) {
  useEffect(() => {
    const key = `su_checkin_${teamId}`;
    try {
      if (Date.now() - Number(localStorage.getItem(key) ?? 0) < DAY) return;
      localStorage.setItem(key, String(Date.now()));
    } catch {}
    checkInPhone(teamId).catch(() => {});
  }, [teamId]);
  return null;
}
