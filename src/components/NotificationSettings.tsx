"use client";

import { useEffect, useState, useTransition } from "react";
import { getPushPrefs, savePushSubscription, sendTestPush } from "@/app/[team]/messaging-actions";

type Prefs = { board: boolean; chat: boolean; games: boolean; reminders: boolean };
type Mode = "loading" | "unsupported" | "ios-install" | "blocked" | "ready";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

// Per-device switches for message-board and chat notifications.
export function NotificationSettings({ teamId, vapidKey }: { teamId: string; vapidKey: string | null }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [prefs, setPrefs] = useState<Prefs>({ board: false, chat: false, games: false, reminders: false });
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!vapidKey || !("serviceWorker" in navigator)) return setMode("unsupported");
      if (!("PushManager" in window) || !("Notification" in window)) {
        return setMode(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setMode("blocked");
      try {
        const reg = await registration();
        const sub = await reg.pushManager.getSubscription();
        const saved = sub ? await getPushPrefs(teamId, sub.endpoint) : null;
        if (saved) setPrefs(saved);
      } catch {}
      setMode("ready");
    })();
  }, [teamId, vapidKey]);

  function update(next: Prefs) {
    setError(null);
    start(async () => {
      try {
        const reg = await registration();
        let sub = await reg.pushManager.getSubscription();
        if (!sub && (next.board || next.chat || next.games || next.reminders)) {
          if ((await Notification.requestPermission()) !== "granted") {
            setMode(Notification.permission === "denied" ? "blocked" : "ready");
            return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey!),
          });
        }
        if (!sub) return setPrefs(next);
        const res = await savePushSubscription(teamId, sub.toJSON() as never, next);
        if (res?.error) return setError(res.error);
        setPrefs(next);
      } catch {
        setError("Couldn’t change notifications on this device.");
      }
    });
  }

  if (mode === "loading") return null;

  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>Notifications</span>
        <span className="text-xs font-normal text-zinc-500">
          {mode === "ready" ? (prefs.board || prefs.chat || prefs.games || prefs.reminders ? "On" : "Off") : "Unavailable"}
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        {mode === "unsupported" && <p className="text-zinc-500">This browser can’t show notifications. The tabs still show what’s new.</p>}
        {mode === "ios-install" && (
          <p className="text-zinc-500">
            On iPhone, notifications only work from the installed app: tap <b>Share</b> → <b>Add to Home Screen</b>, then open the
            app from your home screen and turn them on here.
          </p>
        )}
        {mode === "blocked" && (
          <p className="text-zinc-500">Notifications are blocked for this site. Allow them in your phone’s browser settings, then come back here.</p>
        )}
        {mode === "ready" && (
          <>
            <Toggle
              label="Game changes"
              hint="New time or pitch, postponed or cancelled"
              checked={prefs.games}
              disabled={pending}
              onChange={(v) => update({ ...prefs, games: v })}
            />
            <Toggle
              label="Reminders"
              hint="“Can your child play?” two days before, and on game day"
              checked={prefs.reminders}
              disabled={pending}
              onChange={(v) => update({ ...prefs, reminders: v })}
            />
            <Toggle label="Message board" hint="When the coach posts" checked={prefs.board} disabled={pending} onChange={(v) => update({ ...prefs, board: v })} />
            <Toggle label="Team chat" hint="When someone writes in the chat" checked={prefs.chat} disabled={pending} onChange={(v) => update({ ...prefs, chat: v })} />
            <p className="text-xs text-zinc-400">Applies to this phone only.</p>
            {(prefs.board || prefs.chat || prefs.games || prefs.reminders) && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    setTested(null);
                    const reg = await registration();
                    const sub = await reg.pushManager.getSubscription();
                    if (!sub) return setError("This phone isn’t subscribed. Switch one of the options off and on again.");
                    const res = await sendTestPush(teamId, sub.endpoint);
                    if (res.error) setError(res.error);
                    else setTested("Sent. It should pop up in a few seconds.");
                  })
                }
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs"
              >
                Send a test notification
              </button>
            )}
            {tested && <p className="text-xs text-emerald-700">{tested}</p>}
          </>
        )}
        {error && <p className="text-accent">{error}</p>}
      </div>
    </details>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-emerald-600" : "bg-zinc-300"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
