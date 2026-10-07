"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmLeagueCode, requestLeagueReview, sendLeagueCode } from "./actions";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base";

// Unlocks league announcements: prove you run the league with a one-time code
// sent to an email on its own domain, or ask Sidelnr to review it.
export function VerifyLeague({
  competitionId,
  domains,
  reviewRequested,
}: {
  competitionId: string;
  domains: string[]; // e.g. ["wnbl.com.au"]
  reviewRequested: string | null; // when a review was asked for, if one is waiting
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const res = await sendLeagueCode(competitionId, email);
      if ("error" in res) return setMsg({ error: res.error });
      setStep("code");
      setMsg({ ok: `Code sent to ${email.trim()}. It expires in 15 minutes.` });
    });
  const confirm = () =>
    start(async () => {
      const res = await confirmLeagueCode(competitionId, code);
      if ("error" in res) return setMsg({ error: res.error });
      setMsg({ ok: "Verified. This league is now official." });
      router.refresh();
    });
  const review = () =>
    start(async () => {
      const res = await requestLeagueReview(competitionId, note);
      if ("error" in res) return setMsg({ error: res.error });
      setMsg({ ok: "Thanks. We’ll check and get back to you." });
      router.refresh();
    });

  return (
    <div className="space-y-4 text-sm">
      <p className="text-zinc-600">
        Anyone can set up or import a league, so announcements only unlock once the league is verified as official. Verified
        leagues get a tick next to their name.
      </p>

      {domains.length > 0 && (
        <div className="space-y-2">
          <span className="block font-medium">Verify with an official email</span>
          {step === "email" ? (
            <>
              <span className="block text-xs text-zinc-500">
                An address on the league’s own domain ({domains.map((d) => `@${d}`).join(" or ")}). We email it a 6-digit code.
              </span>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={`e.g. office@${domains[0]}`}
                  className={`${field} min-w-0 flex-1`}
                />
                <button type="button" onClick={send} disabled={pending || !email.trim()} className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30">
                  {pending ? "Sending…" : "Send code"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className={`${field} min-w-0 flex-1 font-mono tracking-widest`}
                />
                <button type="button" onClick={confirm} disabled={pending || code.length !== 6} className="rounded-xl bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-30">
                  {pending ? "Checking…" : "Verify"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setMsg(null);
                }}
                className="text-xs text-zinc-500 underline"
              >
                Use a different email or send a new code
              </button>
            </>
          )}
        </div>
      )}

      <div className="space-y-2 border-t border-zinc-100 pt-3">
        <span className="block font-medium">{domains.length ? "No email on that domain?" : "Request a review"}</span>
        {reviewRequested ? (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Review requested on {reviewRequested}. We’ll be in touch.</p>
        ) : (
          <>
            <span className="block text-xs text-zinc-500">
              Tell us your role in the league and how we can confirm it (e.g. a phone number or the league’s Facebook page). We check
              by hand.
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className={field} />
            <button type="button" onClick={review} disabled={pending || note.trim().length < 10} className="rounded-xl border border-zinc-300 px-3 py-2 font-medium text-zinc-800 disabled:opacity-40">
              Request a review
            </button>
          </>
        )}
      </div>

      {msg?.error && <p className="text-accent">{msg.error}</p>}
      {msg?.ok && <p className="text-emerald-700">{msg.ok}</p>}
    </div>
  );
}
