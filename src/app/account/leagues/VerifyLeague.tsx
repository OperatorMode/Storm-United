"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestLeagueReview } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

// Official access (announcements, the tick, and owning an imported league) is
// set up by Sidelnr for each league, by hand: the request goes to the Sidelnr
// owner, who replies by email.
export function VerifyLeague({
  competitionId,
  contactEmail,
  reviewRequested,
  claim = false,
}: {
  competitionId: string;
  contactEmail: string | null; // the signed-in manager's email: where the reply goes
  reviewRequested: string | null; // when a request was sent, if one is waiting
  claim?: boolean; // an imported league: this is how someone claims it
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  const request = () =>
    start(async () => {
      const res = await requestLeagueReview(competitionId, note);
      if ("error" in res) return setMsg({ error: res.error });
      setMsg({ ok: "Thanks. We’ll be in touch by email." });
      router.refresh();
    });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-600">
        {claim
          ? "Official access is set up by Sidelnr for each league."
          : "Anyone can set up or import a league, so announcements only unlock once Sidelnr has made the league official. Official leagues get a tick next to their name."}{" "}
        Tell us who you are and we’ll reply by email{contactEmail ? ` to ${contactEmail}` : ""}.
      </p>
      {reviewRequested ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Request sent on {reviewRequested}. We’ll be in touch by email.</p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block font-medium">Your role in the league, and how to reach you</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="e.g. I’m the competition secretary. Best number: 0400 000 000. About 40 teams this season."
              className={field}
            />
          </label>
          <button
            type="button"
            onClick={request}
            disabled={pending || note.trim().length < 10}
            className="w-full rounded-xl bg-zinc-900 px-3 py-2.5 font-semibold text-white disabled:opacity-30"
          >
            {pending ? "Sending…" : claim ? "Request to claim this league" : "Request official access"}
          </button>
        </>
      )}
      {msg?.error && <p className="text-accent">{msg.error}</p>}
      {msg?.ok && !reviewRequested && <p className="text-emerald-700">{msg.ok}</p>}
    </div>
  );
}
