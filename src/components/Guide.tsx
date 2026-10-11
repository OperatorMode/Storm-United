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
type Path = { id: string; label: string; who: string; steps: Step[] };

const PATHS: Path[] = [
  {
    id: "activities",
    label: "My Activities",
    who: "The full family organiser: sync your kids’ team schedules or create your own events, all in one calendar with clash warnings",
    steps: [
      {
        image: "/guide/act-1-week.webp",
        title: "Your family’s week",
        text: "My Activities on the home page shows every game and training from your kids’ teams, plus everything else, day by day. Each person has their own colour, and Sidelnr warns you when two things clash.",
      },
      {
        image: "/guide/act-2-calendar.webp",
        title: "The month at a glance",
        text: "Switch to Calendar to see the whole month. Each person gets a dot in their colour: with a ring around it if they’re skipping something that day, or just a ring if they’re not going at all. A red ring around a day is a clash, green once it’s solved. Tap a day to see what’s on.",
      },
      {
        image: "/guide/act-5-clash.webp",
        title: "Solve a clash",
        text: "Two things at once? Tap Resolve clash. Choose Not going (the coach sees “Can’t make it”, or an activity skips that time), or pick who’s taking them: you, Mum, Dad, someone it’s shared with, or the child on their own. The rest of the family is told, and the clash turns green: resolved.",
      },
      {
        image: "/guide/act-3-add.webp",
        title: "Add anything",
        text: "Tap + Add activity at the top. Music, dance, swimming, school: add it every week, just once, or from a link to a club’s calendar or timetable. It works for the grown-ups too. Your activities fold away in a list further down.",
      },
      {
        image: "/guide/act-4-share.webp",
        title: "Share: your family, or one event",
        text: "Tap Share. Join our family: their phone becomes part of your family and sees everything. Share one event: just that event, every time or one date, as a Shared event in their own My Activities; they can leave it any time. The code works once.",
      },
      {
        image: "/guide/act-1-week.webp",
        title: "Reminders and your calendar",
        text: "Turn on Reminders at the top for a heads-up a day and an hour before. Add everything to my calendar puts it all in your phone’s calendar, and keeps it up to date.",
      },
    ],
  },
  {
    id: "event",
    label: "My Event",
    who: "Organise a party, birthday or dinner: who’s coming, duties and what to bring, group chat, announcements and private messages",
    steps: [
      {
        image: "/guide/event-1-create.webp",
        title: "Create your event",
        text: "Tap Create event in My Activities, or + Create an event on the home page. Pick the type (Party, Birthday, Dinner) for its look, then when, where, a dress code and a reply-by date. No sign-in needed.",
      },
      {
        image: "/guide/event-2-invite.webp",
        title: "Share the invitation",
        text: "Send the link in a message or your group chat. Only people with the link can open the event. Families a guest invites wait for your OK here.",
      },
      {
        image: "/guide/event-3-answer.webp",
        title: "Guests answer in one tap",
        text: "Guests open the link, type their first name and tap Going, Maybe or Can’t come, with who from their family is coming (for their calendar). No app to install, no account.",
      },
      {
        image: "/guide/event-4-page.webp",
        title: "Everything in one place",
        text: "When and where (with directions), the dress code and details, and adding it to the phone’s calendar. Answers can change any time.",
      },
      {
        image: "/guide/event-5-help.webp",
        title: "Who’s coming, and who brings what",
        text: "Everyone sees who’s coming and how many. Under Can you help?, guests tap I’ll do it for a job, like bringing a salad.",
      },
      {
        image: "/guide/event-6-organiser.webp",
        title: "The Organiser page",
        text: "Let in families a guest invited, see every answer with adults and kids, set the jobs and change the details. Add co-organisers with the organiser code.",
      },
      {
        image: "/guide/event-7-chat.webp",
        title: "News and Chat",
        text: "Post updates under News, and talk to everyone in Chat. Guests get reminders the day before and on the day, with their job.",
      },
    ],
  },
  {
    id: "join",
    label: "Join a team",
    who: "I’m a parent or player joining a team",
    steps: [
      {
        image: "/guide/join-1-code.webp",
        title: "Enter the team code",
        text: "Your coach gives you a team code. Type it on the home page and tap Join team. No account and no password needed.",
      },
      {
        image: "/guide/join-2-who.webp",
        title: "Tell the team who you are",
        text: "Tap I belong to… and tick your child (siblings too), then pick who you are to them: Mum, Dad, Grandparent or anything else. If someone in your family is already in, they get a message to let your phone in.",
      },
      {
        image: "/guide/join-3-team.webp",
        title: "Your team’s page",
        text: "The next game with time, place and directions. Tap Can play, Maybe or Can’t make it, and see who else is coming. Further down: MVP votes (a red Vote now when it’s your turn), the ladder straight from the league’s website, and the season’s fixtures. Tap the picture to see the whole page.",
      },
      {
        image: "/guide/join-5-board.webp",
        title: "Board: news from the coach",
        text: "Only the coach posts on the Board: times, places, what to bring. Tap the green Got it button so the coach knows you’ve seen it.",
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
        text: "On your team’s Home page, choose what your phone tells you: game changes, reminders, the Board, Chat and Private. On iPhone, add Sidelnr to your home screen first (Share, then Add to Home Screen).",
      },
    ],
  },
  {
    id: "manage",
    label: "Manage a team",
    who: "I’m a coach or team manager",
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
        title: "Set up your team",
        text: "A few quick questions: your team’s name, your league, or where you check your games. Sidelnr finds them, and fixtures, results and the ladder then load by themselves.",
      },
      {
        image: "/guide/manage-4-squad.webp",
        title: "Your squad and codes",
        text: "Add players one per line, from your club’s roster link (saved with the team), or from a file. A join code keeps the team private to your families. A manager PIN lets a co-coach help out.",
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
        text: "Everything for running the team, folded into sections, each with a line on what it’s for: game rotation, your team’s special role (if you set one up, like goalie), training, duties, the MVP tally, backup scores and team settings (MVP votes can be turned off there). Tap the picture to see it all.",
      },
      {
        image: "/guide/manage-8-training.webp",
        title: "Training and duties",
        text: "Add weekly training once and it repeats. Cancel a session for rain and families are told. Set up duties like oranges or first aid, and families sign up for match days.",
      },
      {
        image: "/guide/manage-9-family.webp",
        title: "Families look after their own",
        text: "Each family decides who follows their child: new phones need their OK, and they can say Not us. Connected phones shows you everyone, so you can step in when a family can’t, like after a lost phone.",
      },
    ],
  },
  {
    id: "find",
    label: "Add my team",
    who: "Pulls your league’s fixtures and ladder and your team’s roster from the official pages by link, or paste your team’s fixtures from a spreadsheet and we do the rest",
    steps: [
      {
        image: "/guide/find-1-team.webp",
        title: "Start with your team’s name",
        text: "My Team, then Set up your team. Type your team’s name as it’s written in the draw. If Sidelnr already has its league, your team shows up: tap it and you’re nearly done.",
      },
      {
        image: "/guide/find-2-league.webp",
        title: "Or your league",
        text: "Not there? Type your league’s name, in case it’s on Sidelnr under a different team name, and pick your competition.",
      },
      {
        image: "/guide/find-3-link.webp",
        title: "Paste where you check your games",
        text: "Not on Sidelnr yet? Paste the website where you check your games: your club’s or association’s site, or the draw or ladder page. Sidelnr reads it and keeps it up to date by itself.",
      },
      {
        image: "/guide/find-4-search.webp",
        title: "No link? Let Sidelnr look",
        text: "Type the league’s name and where it plays, and Sidelnr searches the web for its fixtures. Pick the right page from what it finds.",
      },
      {
        image: "/guide/find-5-app.webp",
        title: "An app, a spreadsheet or a file",
        text: "Still nothing? Tell it which app you use (many show the draw on a web page too), paste a Google Sheet or calendar link, or set up the league yourself from a file or by typing the games in.",
      },
      {
        image: "/guide/find-6-team.webp",
        title: "Your team",
        text: "Check your team in the draw, add your colours and players, and you’re done: fixtures, results and the ladder load by themselves.",
      },
    ],
  },
  {
    id: "league",
    label: "Run a league",
    who: "A social or hobby comp I run myself",
    steps: [
      {
        image: "/guide/league-6-manual.webp",
        title: "Set it up yourself",
        text: "My League, then Run a league. Add the teams, then the fixtures (typed in, uploaded from a file, from your own spreadsheet, or made for you).",
      },
      {
        image: "/guide/league-3-page.webp",
        title: "Results and the ladder",
        text: "Enter the results after each round and the ladder works itself out. Tap the picture to see the whole page.",
      },
      {
        image: "/guide/manage-3-create.webp",
        title: "Teams join in",
        text: "Coaches set up their team by picking it in your league’s draw, and families join their team with its code. Every team then gets your fixtures and results.",
      },
      {
        image: "/guide/league-5-announce.webp",
        title: "An official league?",
        text: "Leagues on a website or an app aren’t run in Sidelnr: they update by themselves. If you run an official league and want to post to every team at once, ask us by email and we’ll set it up with you.",
      },
    ],
  },
];

const SEEN_KEY = "su_guide_seen";
export const GUIDE_EVENT = "sidelnr:guide";

export function Guide({ autoOpen = false, openNow = false }: { autoOpen?: boolean; openNow?: boolean }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState(0);
  const [zoom, setZoom] = useState(false); // the picture, full size
  const [first, setFirst] = useState(false); // opened by itself on a first visit: say welcome
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
    const t = setTimeout(() => {
      setFirst(!openNow);
      show();
    }, openNow ? 0 : 400); // first visit: let the page appear first
    return () => clearTimeout(t);
  }, [autoOpen, openNow, show]);

  // "How Sidelnr works" on the home page itself.
  useEffect(() => {
    window.addEventListener(GUIDE_EVENT, show);
    return () => window.removeEventListener(GUIDE_EVENT, show);
  }, [show]);

  const close = useCallback(() => {
    setFirst(false);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="How Sidelnr works">
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
          <div className="max-h-[calc(100dvh-env(safe-area-inset-top)-4.5rem)] space-y-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-1">
            <div className="space-y-2">
              {first ? (
                <>
                  <h2 className="text-2xl font-semibold">Welcome to Sidelnr</h2>
                  <p className="text-sm text-zinc-600">Good to have you here. Pick a quick guide to get started, or just look around. You can come back to these any time.</p>
                </>
              ) : (
                <h2 className="text-2xl font-semibold">Quick setup guides</h2>
              )}
              <div className="flex items-baseline justify-between gap-2 pt-2">
                {first ? (
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Quick setup guides</h3>
                ) : (
                  <span />
                )}
                <span className="text-xs text-zinc-400">About a minute each</span>
              </div>
              <div className="grid gap-2 pt-1">
                {PATHS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPath(p);
                      setStep(0);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm active:bg-zinc-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.label}</span>
                      <span className="block text-sm text-zinc-500">{p.who}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{p.steps.length} steps →</span>
                  </button>
                ))}
              </div>
            </div>

            {/* How it fits together: a league, its teams, their families; and the family's own week. */}
            <div className="border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">How it fits together</h3>
              <ol className="mt-2 space-y-1.5 text-sm">
                {[
                  { n: 1, title: "League", text: "fixtures, results and the ladder, read from its website or app when a coach sets up their team, or run by hand for social comps." },
                  { n: 2, title: "Team", text: "a coach picks their team in the league’s draw." },
                  { n: 3, title: "Families and players", text: "join their team with its code." },
                ].map((l) => (
                  <li key={l.n} className="flex gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{l.n}</span>
                    <span className="text-zinc-600">
                      <span className="font-semibold text-zinc-900">{l.title}:</span> {l.text}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
                <span className="font-semibold text-zinc-900">My Activities</span> brings it all together for your family: every
                team’s games and training, plus music, dance and anything else, in one calendar.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-200 p-3 text-sm">
              <span className="font-semibold">Can’t find your team?</span>{" "}
              <span className="text-zinc-600">Set up your team: a few quick questions and Sidelnr finds your games, wherever you check them now.</span>
              <div className="mt-2 flex items-center gap-4">
                <Link href="/account/new" onClick={close} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">
                  Set up your team
                </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setPath(PATHS.find((p) => p.id === "find")!);
                      setStep(0);
                    }}
                    className="text-sm font-medium underline"
                  >
                    Learn how
                  </button>
              </div>
            </div>
            <button type="button" onClick={close} className="w-full py-2 text-sm text-zinc-500 underline">
              Skip, I’ll look around myself
            </button>
            <p className="-mt-2 text-center text-xs text-zinc-400">You can come back any time: How Sidelnr works, at the bottom of each page.</p>
            <p className="text-center text-xs text-zinc-400">
              Sidelnr is self-managed by its teams and families.{" "}
              <Link href="/what-we-see" onClick={close} className="underline">
                What the app developer can see
              </Link>
            </p>
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
