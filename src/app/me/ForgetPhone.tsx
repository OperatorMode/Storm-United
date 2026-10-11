"use client";

import { useTransition } from "react";
import { forgetThisPhone } from "./actions";
import { pushEndpoint } from "@/lib/push-endpoint";

// "Forget this phone": a small link at the very bottom of the home page, as it
// removes everything on this phone (to leave just one team, event or family,
// use its own Leave). Asks first.
export function ForgetPhone() {
  const [pending, start] = useTransition();
  return (
    <button
      id="forget"
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(
          "Forget this phone? It leaves every team and event on this phone, forgets the children it picked, its link to your family’s activities, and its notifications. Your family and teams keep everything. To leave just one, use Leave on that team, event or My Activities.",
        ) && start(async () => forgetThisPhone((await pushEndpoint()) ?? null))
      }
      className="text-xs underline"
    >
      {pending ? "Forgetting…" : "Forget this phone"}
    </button>
  );
}
