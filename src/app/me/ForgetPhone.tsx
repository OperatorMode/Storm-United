"use client";

import { useTransition } from "react";
import { forgetThisPhone } from "./actions";

export function ForgetPhone() {
  const [pending, start] = useTransition();
  return (
    <div id="forget" className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-medium">Forget this phone</div>
      <p className="mt-0.5 text-xs text-zinc-500">
        Removes the teams this phone joined and the children it picked. You can join again any time with the team code.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Forget all teams and children on this phone?") && start(() => forgetThisPhone())}
        className="mt-3 rounded-xl border border-zinc-300 px-4 py-2 text-sm"
      >
        {pending ? "Forgetting…" : "Forget this phone"}
      </button>
    </div>
  );
}
