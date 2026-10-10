"use client";

import { useActionState } from "react";
import { superLogin } from "./actions";

// Two steps: the owner PIN, then the 6-digit code emailed to the owner.
export function SuperLogin({ twoStep }: { twoStep: boolean }) {
  const [state, action, pending] = useActionState(superLogin, null);
  const codeStep = !!state?.codeSent;
  return (
    <form action={action} className="space-y-3">
      {codeStep ? (
        <>
          <p className="text-sm text-zinc-600">
            {state?.codeSent === "again" ? "Enter the code from the email." : `We emailed a 6-digit code to ${state?.codeSent}.`}
          </p>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            className="w-full rounded-xl border border-zinc-300 px-3 py-3 font-mono text-base tracking-widest"
          />
        </>
      ) : (
        <input name="pin" type="password" autoComplete="off" placeholder="Admin PIN" className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-base" />
      )}
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
        {pending ? "Checking…" : codeStep ? "Unlock" : twoStep ? "Next" : "Unlock"}
      </button>
      {state?.error && <p className="text-sm text-accent">{state.error}</p>}
      {!twoStep && <p className="text-xs text-zinc-500">Second step is off: set OWNER_EMAIL in Vercel to get a code by email too.</p>}
    </form>
  );
}
