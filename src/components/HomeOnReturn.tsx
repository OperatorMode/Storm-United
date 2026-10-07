"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The installed app opens on the home page: phones often keep it in the
// background and bring back the last page instead of starting fresh. After a
// while away (not a quick switch to copy a code), go home. Only in the
// installed app, not a browser tab.
const AWAY_MS = 10 * 60 * 1000;

export function HomeOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!installed) return;
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && window.location.pathname !== "/") router.replace("/");
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);
  return null;
}
