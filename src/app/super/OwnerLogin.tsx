"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ownerSignIn } from "./actions";

// Owner sign-in: email and password, then the 6-digit code from an
// authenticator app. The first time, it shows a QR code to set the app up.
export function OwnerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code" | "enroll">("password");
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = "w-full rounded-xl border border-zinc-300 px-3 py-3 text-base";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await ownerSignIn(step === "password" ? { email, password } : { code });
      if (res.error) {
        setError(res.error);
        if (/took too long/.test(res.error)) setStep("password");
        return;
      }
      if (res.ok) return router.refresh();
      setPassword("");
      setCode("");
      if (res.step === "enroll" && res.qr && res.secret) setQr({ qr: res.qr, secret: res.secret });
      if (res.step) setStep(res.step);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {step === "password" ? (
        <>
          <input type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
          />
        </>
      ) : (
        <>
          {step === "enroll" && qr ? (
            <div className="space-y-2 text-sm text-zinc-600">
              <p>
                First time: scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then
                enter the 6-digit code it shows.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qr} alt="QR code for your authenticator app" className="mx-auto size-48 rounded-xl border border-zinc-200 bg-white p-2" />
              <p className="text-xs">
                Can’t scan? Enter this key in the app: <span className="break-all font-mono text-zinc-900">{qr.secret}</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Enter the 6-digit code from your authenticator app.</p>
          )}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${input} font-mono tracking-widest`}
            autoFocus
          />
        </>
      )}
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Checking…" : step === "password" ? "Next" : "Sign in"}
      </button>
      {error && <p className="text-sm text-accent">{error}</p>}
    </form>
  );
}
