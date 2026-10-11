"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveFamily } from "./activity-actions";
import { pushEndpoint } from "@/lib/push-endpoint";

// "Leave this family" at the bottom of My Activities: this phone stops seeing the
// family's activities (and its reminders) and starts its own, empty My
// Activities. The family keeps everything; teams and events stay on the phone.
export function LeaveFamily() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        confirm(
          "Leave this family’s activities on this phone? This phone stops seeing them and their reminders, and starts its own, empty My Activities. The family keeps everything. Your teams and events stay on this phone.",
        ) &&
        start(async () => {
          await leaveFamily((await pushEndpoint()) ?? null);
          router.refresh();
        })
      }
      className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-600"
    >
      {pending ? "Leaving…" : "Leave this family"}
    </button>
  );
}
