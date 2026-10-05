"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/actions";

export function AdminLogin() {
  const [state, action, pending] = useActionState(adminLogin, null);
  return (
    <form action={action} className="space-y-3">
      <input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Admin PIN"
        className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-base"
      />
      <button disabled={pending} className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white">
        {pending ? "Checking…" : "Unlock"}
      </button>
      {state?.error && <p className="text-sm text-accent">{state.error}</p>}
    </form>
  );
}
