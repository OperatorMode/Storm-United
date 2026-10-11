"use client";

import { useTransition } from "react";
import { forgetThisPhone } from "./actions";
import { pushEndpoint } from "@/lib/push-endpoint";

export function ForgetPhone() {
  const [pending, start] = useTransition();
  return (
    <div id="forget" className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-medium">Forget this phone</div>
      <p className="mt-0.5 text-xs text-zinc-500">
        Removes the teams this phone joined, the children it picked, its link to your activities and its notifications. You
        can join again any time with the team code. To delete activities everywhere, remove them under Activities first.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          confirm("Forget all teams, children and activities on this phone?") &&
          start(async () => forgetThisPhone((await pushEndpoint()) ?? null))
        }
        className="mt-3 rounded-xl border border-zinc-300 px-4 py-2 text-sm"
      >
        {pending ? "Forgetting…" : "Forget this phone"}
      </button>
    </div>
  );
}
