"use client";

import { useEffect, useState, useTransition } from "react";
import { getActivityReminders, saveActivityReminders } from "./activity-actions";

type Prefs = { day: boolean; hour: boolean };
type Mode = "loading" | "unsupported" | "ios-install" | "blocked" | "ready";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from([...atob(padded)].map((c) => c.charCodeAt(0)));
}
const registration = () => navigator.serviceWorker.register("/sw.js", { scope: "/" });

// Reminders for the family's own activities on this phone: a day before and
// an hour before, each on or off.
export function ActivityReminders({ vapidKey }: { vapidKey: string | null }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [prefs, setPrefs] = useState<Prefs>({ day: false, hour: false });
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
        if (!sub && (next.day || next.hour)) {
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
  return (
    <div className="space-y-2 text-sm">
      <span className="block font-medium">Reminders on this phone</span>
      {mode === "ready" ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["day", "A day before"],
              ["hour", "An hour before"],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${prefs[k] ? "border-zinc-900 bg-zinc-50 font-medium" : "border-zinc-300 bg-white text-zinc-700"}`}
            >
              <input type="checkbox" checked={prefs[k]} disabled={pending} onChange={() => update({ ...prefs, [k]: !prefs[k] })} className="size-4 accent-zinc-900" />
              {label}
            </label>
          ))}
        </div>
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
  );
}
