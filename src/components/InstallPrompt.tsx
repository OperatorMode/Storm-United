"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "su_install_dismissed";

// Android/Chrome: offers a real "Install" button via beforeinstallprompt.
// iPhone/iPad Safari has no install API, so we explain Share → Add to Home Screen.
export function InstallPrompt() {
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    // Defer so the state update isn't synchronous inside the effect body.
    if (isIos) queueMicrotask(() => setMode("ios"));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("hidden");
  }

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Get the app</div>
        {mode === "android" ? (
          <p className="mt-0.5 text-sm text-zinc-500">Add Storm United to your home screen.</p>
        ) : (
          <p className="mt-0.5 text-sm text-zinc-500">
            Tap <ShareIcon /> <b className="font-medium text-zinc-700">Share</b> in Safari, then{" "}
            <b className="font-medium text-zinc-700">Add to Home Screen</b>.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {mode === "android" && event && (
            <button
              type="button"
              onClick={async () => {
                await event.prompt();
                const { outcome } = await event.userChoice;
                if (outcome === "accepted") setMode("hidden");
              }}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Install
            </button>
          )}
          <button type="button" onClick={dismiss} className="rounded-xl px-3 py-2 text-sm text-zinc-500">
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="-mt-0.5 inline size-4 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
