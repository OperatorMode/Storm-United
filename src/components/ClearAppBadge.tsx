"use client";

import { useEffect } from "react";

// Opening Sidelnr clears the number on its app icon (where phones support it).
export function ClearAppBadge() {
  useEffect(() => {
    const clear = () => {
      if (document.visibilityState !== "visible") return;
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      nav.clearAppBadge?.().catch(() => {});
    };
    clear();
    document.addEventListener("visibilitychange", clear);
    return () => document.removeEventListener("visibilitychange", clear);
  }, []);
  return null;
}
