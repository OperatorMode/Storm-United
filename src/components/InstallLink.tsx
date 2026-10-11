"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// A small "Install app" link for the bottom of pages, so installing is never
// gone for good once the install card has been put away. Hidden when already
// running as the installed app. Android/Chrome: the real install prompt;
// iPhone/iPad, or when the browser offers none: how to do it by hand.
export function InstallLink({ className = "underline", before }: { className?: string; before?: React.ReactNode }) {
  const [installed, setInstalled] = useState(true);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    queueMicrotask(() => setInstalled(standalone));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const open = async () => {
    if (event) {
      await event.prompt();
      if ((await event.userChoice).outcome === "accepted") setInstalled(true);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    setHelp(
      ios
        ? "In Safari, tap Share, then Add to Home Screen."
        : "Open your browser’s menu (⋮) and choose Install app or Add to Home screen.",
    );
  };

  return (
    <>
      {before}
      <button type="button" onClick={open} className={className}>
        Install app
      </button>
      {help && (
        <span className="mt-1 block">
          {help}{" "}
          <button type="button" onClick={() => setHelp(null)} className="underline">
            OK
          </button>
        </span>
      )}
    </>
  );
}
