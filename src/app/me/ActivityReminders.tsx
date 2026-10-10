"use client";

import { useEffect, useState, useTransition } from "react";
import { getActivityReminders, saveActivityReminders } from "./activity-actions";

type Prefs = { day: boolean; hour: boolean; news: boolean };
type Mode = "loading" | "unsupported" | "ios-install" | "blocked" | "ready";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(padded)].map((c) => c.charCodeAt(0)));
}
const registration = () => navigator.serviceWorker.register("/sw.js", { scope: "/" });

// A small "Reminders" switch at the top of My Activities, for all activities on
// this phone: a day before, an hour before, and when someone else adds one.
export function ActivityReminders({ vapidKey }: { vapidKey: string | null }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [prefs, setPrefs] = useState<Prefs>({ day: false, hour: false, news: false });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!vapidKey || !("serviceWorker" in navigator)) return setMode("unsupported");
      if (!("PushManager" in window) || !("Notification" in window)) return setMode(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setMode("blocked");
      try {
        const sub = await (await registration()).pushManager.getSubscription();
        const saved = sub ? await getActivityReminders(sub.endpoint) : null;
        if (saved) setPrefs(saved);
      } catch {}
      setMode("ready");
    })();
  }, [vapidKey]);

  const update = (next: Prefs) =>
    start(async () => {
      setError(null);
      try {
        const reg = await registration();
        let sub = await reg.pushManager.getSubscription();
        if (!sub && (next.day || next.hour || next.news)) {
          if ((await Notification.requestPermission()) !== "granted") {
            setMode(Notification.permission === "denied" ? "blocked" : "ready");
            return;
          }
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey!) });
        }
        if (!sub) return setPrefs(next);
        const res = await saveActivityReminders(sub.toJSON() as never, next);
        if ("error" in res) return setError(res.error ?? "Couldn’t save.");
        setPrefs(next);
      } catch {
        setError("Couldn’t change reminders on this phone.");
      }
    });

  if (mode === "loading") return null;
  const on = prefs.day || prefs.hour || prefs.news;
  return (
    <div className="text-sm">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"}`}
        >
          Reminders: {on ? "On" : "Off"}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
          <span className="block text-xs text-zinc-500">For all activities, on this phone.</span>
          {mode === "ready" ? (
            (
              [
                ["day", "A day before"],
                ["hour", "An hour before"],
                ["news", "When someone adds an activity you share"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={prefs[k]} disabled={pending} onChange={() => update({ ...prefs, [k]: !prefs[k] })} className="size-4 accent-zinc-900" />
                {label}
              </label>
            ))
          ) : (
            <p className="text-xs text-zinc-500">
              {mode === "ios-install"
                ? "On iPhone, add Sidelnr to your home screen first (Share, then Add to Home Screen), then turn reminders on from there."
                : mode === "blocked"
                  ? "Notifications are blocked for Sidelnr on this phone. Allow them in your phone’s settings to get reminders."
                  : "This browser can’t show notifications."}
            </p>
          )}
          {error && <p className="text-xs text-accent">{error}</p>}
        </div>
      )}
    </div>
  );
}
