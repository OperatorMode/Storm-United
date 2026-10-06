"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestLoginLink } from "@/app/account/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestLoginLink, null);
  if (state && "sent" in state) {
    return (
      <div className="space-y-2 text-sm">
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="text-zinc-600">
          We sent a sign-in link to <b>{state.email}</b>. Tap it on this device to sign in. It expires in 15 minutes.
        </p>
        <p className="text-xs text-zinc-400">Nothing there? Check spam, or go back and try again.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <h2 className="font-semibold">Sign in with email</h2>
      <p className="text-sm text-zinc-500">We’ll email you a one-tap sign-in link. No password needed.</p>
      <p className="text-xs text-zinc-400">
        By signing in you agree to the{" "}
        <Link href="/terms" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={state?.email}
        placeholder="you@example.com"
        className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-base"
      />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state && "error" in state && <p className="text-sm text-accent">{state.error}</p>}
    </form>
  );
}
