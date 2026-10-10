"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// "How Sidelnr works": a short guide over the home page. It asks why you're
// here, then shows the basics for that with real screens (made-up teams and
// people) and a sentence or two each, one step at a time. It opens by itself
// on a new phone's first visit, and from "How Sidelnr works" at the bottom of
// pages any time after.

type Step = { image: string; title: string; text: string };
type Path = { id: string; label: string; steps: Step[] };

const PATHS: Path[] = [
  {
    id: "join",
    label: "Join a team",
    steps: [
      {
        image: "/guide/join-1-code.webp",
        title: "Enter the team code",
        text: "Your coach gives you a team code. Type it on the home page and tap Join team. No account and no password needed.",
      },
      {
        image: "/guide/join-2-who.webp",
        title: "Tell the team who you are",
        text: "Tap I belong to… and tick your child (siblings too), then pick who you are to them: Mum, Dad, Grandparent or anything else. Players tap I am… and their own name.",
      },
      {
        image: "/guide/join-3-attendance.webp",
        title: "Can your child play?",
        text: "Tap Can play, Maybe or Can’t make it for the next game, and put a hand up for goalie. You can see who else is coming. After each game, vote for MVP.",
      },
      {
        image: "/guide/join-5-board.webp",
        title: "Messages from the coach",
        text: "The Board has the coach’s updates. Tap Got it so the coach knows you’ve seen it.",
      },
      {
        image: "/guide/join-4-chat.webp",
        title: "Team chat",
        text: "Talk to the whole team in Chat. For one person or a small group, use Messages. Everyone shows as who they are, like “Ava’s Mum”.",
      },
      {
        image: "/guide/join-6-notify.webp",
        title: "Turn on notifications",
        text: "Choose what your phone tells you: game changes, reminders, the coach’s posts and chat. On iPhone, add Sidelnr to your home screen first (Share, then Add to Home Screen).",
      },
    ],
  },
];

// Coming next: shown in the list, not ready yet.
const LATER = ["Manage a team", "Create a league"];

const SEEN_KEY = "su_guide_seen";
export const GUIDE_EVENT = "sidelnr:guide";

export function Guide({ autoOpen = false, openNow = false }: { autoOpen?: boolean; openNow?: boolean }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState(0);
  const touch = useRef<number | null>(null);

  const show = useCallback(() => {
    setPath(null);
    setStep(0);
    setOpen(true);
  }, []);

  // First visit on a new phone, or "?guide" in the address (from other pages).
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (openNow) window.history.replaceState(null, "", window.location.pathname);
    if (!openNow && (!autoOpen || seen)) return;
    const t = setTimeout(show, openNow ? 0 : 400); // first visit: let the page appear first
    return () => clearTimeout(t);
  }, [autoOpen, openNow, show]);

  // "How Sidelnr works" on the home page itself.
  useEffect(() => {
    window.addEventListener(GUIDE_EVENT, show);
    return () => window.removeEventListener(GUIDE_EVENT, show);
  }, [show]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  const steps = path?.steps ?? [];
  const go = useCallback((n: number) => setStep((s) => Math.min(Math.max(s + n, 0), Math.max(steps.length - 1, 0))), [steps.length]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (path && e.key === "ArrowRight") go(1);
      if (path && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [open, path, go, close]);

  if (!open) return null;
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="How Sidelnr works">
      <div className="flex max-h-[100dvh] w-full max-w-md flex-col rounded-t-3xl bg-white text-zinc-950 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="text-sm font-semibold">How Sidelnr works</div>
          <button type="button" onClick={close} className="grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-600" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {!path ? (
          <div className="space-y-4 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
            <h2 className="text-2xl font-semibold">Why are you here?</h2>
            <p className="text-sm text-zinc-600">Pick one and we’ll show you the basics in a few steps.</p>
            <select
              defaultValue=""
              onChange={(e) => {
                const p = PATHS.find((x) => x.id === e.target.value);
                if (p) {
                  setPath(p);
                  setStep(0);
                }
              }}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base"
            >
              <option value="" disabled>
                Choose…
              </option>
              {PATHS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              {LATER.map((l) => (
                <option key={l} value={l} disabled>
                  {l} (coming soon)
                </option>
              ))}
            </select>
            <button type="button" onClick={close} className="w-full py-2 text-sm text-zinc-500 underline">
              Skip, I’ll look around myself
            </button>
          </div>
        ) : (
          <>
            <div
              className="min-h-0 flex-1 px-5"
              onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touch.current === null) return;
                const dx = e.changedTouches[0].clientX - touch.current;
                touch.current = null;
                if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              }}
            >
              <div className="mx-auto w-fit overflow-hidden rounded-[1.75rem] border-[6px] border-zinc-900 bg-zinc-100 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={current.image} src={current.image} alt={current.title} className="block h-[min(46dvh,420px)] w-auto" draggable={false} />
              </div>
              <div className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {path.label} · {step + 1} of {steps.length}
              </div>
              <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
              <p className="mt-1 min-h-[4.5rem] text-sm leading-relaxed text-zinc-600">{current.text}</p>
            </div>
            <div className="space-y-3 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
              <div className="flex justify-center gap-1.5" aria-hidden>
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    tabIndex={-1}
                    onClick={() => setStep(i)}
                    className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-zinc-900" : "w-1.5 bg-zinc-300"}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => (step === 0 ? setPath(null) : go(-1))}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium"
                >
                  ← {step === 0 ? "Start" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => (last ? close() : go(1))}
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {last ? "Done" : "Next →"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** "How Sidelnr works": opens the guide (on the home page, or takes you there). */
export function GuideLink({ className = "underline", children = "How Sidelnr works" }: { className?: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Link
      href="/?guide"
      className={className}
      onClick={(e) => {
        if (pathname !== "/") return;
        e.preventDefault();
        window.dispatchEvent(new Event(GUIDE_EVENT));
      }}
      onMouseEnter={() => router.prefetch("/")}
    >
      {children}
    </Link>
  );
}
