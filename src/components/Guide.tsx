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
        image: "/guide/join-3-team.webp",
        title: "Your team’s page",
        text: "The next game with time, place and directions. Tap Can play, Maybe or Can’t make it, and see who else is coming. Further down: the ladder and the season’s fixtures. Tap the picture to see the whole page.",
      },
      {
        image: "/guide/join-5-board.webp",
        title: "Board: news from the coach",
        text: "Only the coach posts on the Board: times, places, what to bring. Tap Got it so the coach knows you’ve seen it.",
      },
      {
        image: "/guide/join-4-chat.webp",
        title: "Chat: the whole team",
        text: "Everyone in the team can read and write in Chat, like a group chat. Everyone shows as who they are, like “Ava’s Mum”.",
      },
      {
        image: "/guide/join-7-private.webp",
        title: "Private: just a few people",
        text: "Message one person, the coach, or a small group like a carpool. Only the people in the conversation can read it.",
      },
      {
        image: "/guide/join-6-notify.webp",
        title: "Turn on notifications",
        text: "Choose what your phone tells you: game changes, reminders, the Board, Chat and Private. On iPhone, add Sidelnr to your home screen first (Share, then Add to Home Screen).",
      },
    ],
  },
  {
    id: "manage",
    label: "Manage a team",
    steps: [
      {
        image: "/guide/manage-1-signin.webp",
        title: "Sign in with your email",
        text: "On the home page, tap My Team. Enter your email and tap the link we send you. No password needed.",
      },
      {
        image: "/guide/manage-2-myteams.webp",
        title: "My teams",
        text: "All the teams you run in one place. Create a team, Edit its details, or tap Manage to open Manager’s Corner.",
      },
      {
        image: "/guide/manage-3-create.webp",
        title: "Create your team",
        text: "Search for your competition and pick your team in its draw. Fixtures, results and the ladder then load by themselves. Choose your colours, and add a logo if you have one.",
      },
      {
        image: "/guide/manage-4-squad.webp",
        title: "Your squad and codes",
        text: "Add players one per line, or find them on the league’s website. A join code keeps the team private to your families. A manager PIN lets a co-coach help out.",
      },
      {
        image: "/guide/manage-5-share.webp",
        title: "Invite your families",
        text: "Send families your team’s link (and the join code, if you set one), for example in your existing group chat. They pick their child once and they’re in.",
      },
      {
        image: "/guide/manage-6-board.webp",
        title: "Post on the Board",
        text: "Tell every family at once: times, changes, what to bring. They get a notification and tap Got it, so you can see who’s read it and who you’re still waiting on.",
      },
      {
        image: "/guide/manage-7-corner.webp",
        title: "Manager’s Corner",
        text: "Everything for running the team, folded into sections: game rotation, goalies, training, duties, the MVP tally, backup scores and team settings. Tap the picture to see it all.",
      },
      {
        image: "/guide/manage-8-training.webp",
        title: "Training and duties",
        text: "Add weekly training once and it repeats. Cancel a session for rain and families are told. Set up duties like oranges or first aid, and families sign up for match days.",
      },
      {
        image: "/guide/manage-9-phones.webp",
        title: "Connected phones",
        text: "See who follows each player, like “Ava’s Mum”. If a phone picked the wrong child, remove it, and it can’t pick them again.",
      },
    ],
  },
];

// Coming next: shown in the list, not ready yet.
const LATER = ["Create a league"];

const SEEN_KEY = "su_guide_seen";
export const GUIDE_EVENT = "sidelnr:guide";

export function Guide({ autoOpen = false, openNow = false }: { autoOpen?: boolean; openNow?: boolean }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState(false); // the picture, full size
  const touch = useRef<number | null>(null);

  const show = useCallback(() => {
    setZoom(false);
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
      if (e.key === "Escape") return zoom ? setZoom(false) : close();
      if (zoom) return;
      if (path && e.key === "ArrowRight") go(1);
      if (path && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [open, path, zoom, go, close]);

  if (!open) return null;
  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="How Sidelnr works">
      <div
        className={`flex w-full max-w-md flex-col rounded-t-3xl bg-white text-zinc-950 shadow-2xl sm:rounded-3xl ${path ? "h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] sm:h-[min(92dvh,900px)]" : ""}`}
      >
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
              className="min-h-0 flex-1 px-5 pt-1"
              onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                if (touch.current === null) return;
                const dx = e.changedTouches[0].clientX - touch.current;
                touch.current = null;
                if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              }}
            >
              <div className="flex h-full min-h-0 justify-center">
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="aspect-[390/844] h-full max-w-full overflow-hidden rounded-[1.75rem] border-[6px] border-zinc-900 bg-zinc-100 shadow-lg"
                  aria-label="Zoom in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img key={current.image} src={current.image} alt={current.title} className="h-full w-full object-cover object-top" draggable={false} />
                </button>
              </div>
            </div>
            <div className="px-5 pt-3">
              <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
                <span className="font-medium uppercase tracking-wide">
                  {path.label} · {step + 1} of {steps.length}
                </span>
                <button type="button" onClick={() => setZoom(true)} className="underline">
                  Tap picture to zoom
                </button>
              </div>
              <h2 className="mt-0.5 text-xl font-semibold">{current.title}</h2>
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

      {zoom && current && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90" onClick={() => setZoom(false)}>
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="sticky left-full top-3 z-10 mr-3 mt-3 grid size-10 place-items-center rounded-full bg-white text-zinc-900 shadow"
            aria-label="Close picture"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.image} alt={current.title} className="mx-auto -mt-10 block w-full max-w-md pb-[env(safe-area-inset-bottom)]" />
        </div>
      )}
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
