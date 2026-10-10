"use client";

import { useTransition } from "react";
import { decidePhone } from "@/app/[team]/actions";

export type OtherPhone = { memberId: string; childId: string; childName: string; label: string; device: string; when: string };

// The family owns their child's access. New phones picking their child wait
// here until the family lets them in (or says "Not us"), and the family can
// see every other phone following their child.
export function FamilyRequests({ teamId, requests }: { teamId: string; requests: OtherPhone[] }) {
  const [pending, start] = useTransition();
  if (!requests.length) return null;
  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm shadow-sm">
      <h2 className="font-semibold">{requests.length === 1 ? "A new phone wants to follow your child" : "New phones want to follow your child"}</h2>
      <p className="mt-0.5 text-amber-900/80">Only let in people you know. They’ll see the team as your family does and can post as themselves.</p>
      <ul className="mt-3 space-y-3">
        {requests.map((r) => (
          <li key={`${r.memberId}-${r.childId}`} className="rounded-xl bg-white p-3">
            <div className="font-medium">{r.label}</div>
            <div className="text-xs text-zinc-500">
              Wants to follow {r.childName} · {r.device} · {r.when}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => decidePhone(teamId, r.memberId, r.childId, true).then(() => {}))}
                className="rounded-lg bg-zinc-900 py-2 text-sm font-semibold text-white"
              >
                Let in
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  confirm(`Not someone you know? This phone won’t be able to pick ${r.childName} again.`) &&
                  start(() => decidePhone(teamId, r.memberId, r.childId, false).then(() => {}))
                }
                className="rounded-lg border border-zinc-300 py-2 text-sm"
              >
                Not us
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FamilyFollowers({ teamId, kidsLabel, followers }: { teamId: string; kidsLabel: string; followers: OtherPhone[] }) {
  const [pending, start] = useTransition();
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
        <span>Who follows {kidsLabel}</span>
        <span className="text-xs font-normal text-zinc-500">
          {followers.length ? `${followers.length + 1} phones` : "Just this phone"}
        </span>
      </summary>
      <ul className="mt-3 divide-y divide-zinc-100">
        <li className="py-2 text-zinc-500">This phone</li>
        {followers.map((f) => (
          <li key={`${f.memberId}-${f.childId}`} className="flex items-center justify-between gap-2 py-2">
            <span>
              {f.label}
              <span className="block text-xs text-zinc-500">
                {f.device} · seen {f.when}
              </span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                confirm(`Not someone you know? Take ${f.childName} off this ${f.device}. It won’t be able to pick ${f.childName} again.`) &&
                start(() => decidePhone(teamId, f.memberId, f.childId, false).then(() => {}))
              }
              className="shrink-0 text-xs text-red-700 underline"
            >
              Not us
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">New phones that pick {kidsLabel} need your OK first.</p>
    </details>
  );
}
