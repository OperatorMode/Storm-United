"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importLeagueAction, scanLeagueAction } from "./actions";
import { TimezoneSelect } from "./LeagueForms";
import type { LeagueScan } from "@/lib/league-scan";
import { loadingSlides } from "./loading-trivia";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";
const SCANNING = [
  "Opening the page…",
  "Looking for the fixtures…",
  "Working out the competitions…",
  "Counting the teams…",
  "Reading the draw…",
  "Matching teams to games…",
  "Still reading, big websites take a little longer…",
];
const IMPORTING = [
  "Creating your league…",
  "Reading every game…",
  "Adding the teams…",
  "Connecting the link so results keep updating…",
  "Nearly there…",
];

// "Got a league website? Let's see what we can pull." Paste a link, we read
// it, you pick the competition (if there are several), and we import it all.
export function MagicImport() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [scan, setScan] = useState<LeagueScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"link" | "scanning" | "found" | "importing">("link");
  const [competition, setCompetition] = useState("");
  const [leagueName, setLeagueName] = useState("");

  // Plain async handlers, not a transition: the overlay has to show while it works.
  const find = async () => {
    setError(null);
    setStage("scanning");
    const res = await scanLeagueAction(url).catch(() => ({ scan: undefined, error: "Couldn’t read that link just now. Try again." }));
    if (res.error || !res.scan) {
      setError(res.error ?? "Couldn’t read that link.");
      setStage("link");
      return;
    }
    setScan(res.scan);
    setLeagueName(res.scan.leagueName);
    setCompetition(res.scan.competitions.length === 1 ? res.scan.competitions[0].name : "");
    setStage("found");
  };

  const doImport = async (form: FormData) => {
    if (!scan) return;
    setError(null);
    setStage("importing");
    const res = await importLeagueAction({
      feedUrl: scan.feedUrl,
      feedType: scan.feedType,
      leagueName,
      shortName: scan.shortName,
      venue: scan.venue,
      timezone: String(form.get("timezone") ?? ""),
      ladderStyle: scan.ladderStyle,
      ladderUrl: scan.ladderUrl,
      competition,
      filter: scan.competitions.length > 1,
    }).catch(() => ({ competitionId: null, error: "Something went wrong. Try again." }));
    if (res.competitionId) {
      router.push(`/account/competitions/${res.competitionId}?new=1`);
      return; // the overlay stays up until the new page shows
    }
    setError(res.error ?? "Something went wrong.");
    setStage("found");
  };

  const busy = stage === "scanning" || stage === "importing";
  return (
    <>
      {busy && <Working key={stage} messages={stage === "scanning" ? SCANNING : IMPORTING} />}
      {(stage === "found" || stage === "importing") && scan ? found(scan) : linkForm()}
    </>
  );

  function found(scan: LeagueScan) {
    const many = scan.competitions.length > 1;
    const chosen = scan.competitions.find((c) => c.name === competition);
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doImport(new FormData(e.currentTarget));
        }}
        className="space-y-4 text-sm"
      >
        {scan.competitions.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{scan.note ?? "No fixtures found at that link."}</p>
            <button type="button" onClick={() => setStage("link")} className="text-zinc-600 underline">
              Try another link
            </button>
          </div>
        ) : (
          <>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">
              {many
                ? `Found ${scan.competitions.length} competitions. Which one is yours?`
                : `Found ${chosen?.games ?? 0} games between ${chosen?.teams ?? 0} teams.`}
            </p>
            {many && (
              <label className="block">
                <span className="mb-1 block font-medium">Which competition?</span>
                <select value={competition} onChange={(e) => setCompetition(e.target.value)} className={field} required>
                  <option value="">Choose…</option>
                  {scan.competitions.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.teams} teams, {c.games} games)
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-zinc-500">Only this one is imported. You can add others later.</span>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block font-medium">League name</span>
              <input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} className={field} required />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Timezone</span>
              <TimezoneSelect initial={scan.timezone ?? undefined} />
              <span className="mt-1 block text-xs text-zinc-500">Game times are shown in this timezone.</span>
            </label>
            <p className="truncate text-xs text-zinc-500">From {scan.feedUrl}</p>
            <button disabled={busy || (many && !competition)} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30">
              Import {chosen ? chosen.name : "it"}
            </button>
            <button type="button" onClick={() => setStage("link")} className="w-full text-center text-zinc-500 underline">
              Start again
            </button>
          </>
        )}
        {error && <p className="text-accent">{error}</p>}
      </form>
    );
  }

  function linkForm() {
  return (
    <div className="space-y-4 text-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
        className="space-y-3"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="e.g. nbl.com.au or your league’s fixtures page"
          className={field}
          required
        />
        <button disabled={busy || !url.trim()} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent disabled:opacity-40">
          Find my league
        </button>
        <p className="text-xs text-zinc-500">A website, a Google Sheet or a calendar link all work. This can take a minute or two.</p>
      </form>
      {error && <p className="text-accent">{error}</p>}
    </div>
  );
  }
}

// Dims the whole screen and shows a spinner with messages that change as it works.
function Working({ messages }: { messages: string[] }) {
  const [slides] = useState(() => loadingSlides(messages));
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % slides.length), slides[i].ms);
    return () => clearTimeout(t);
  }, [i, slides]);
  const slide = slides[i];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex w-full max-w-xs flex-col items-center gap-5 text-center text-white">
        <svg className="size-14 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div key={i} className="flex min-h-28 animate-[fadein_0.6s_ease] flex-col items-center justify-center gap-1">
          {slide.label && <div className="text-xs font-semibold uppercase tracking-widest text-accent">{slide.label}</div>}
          <p className={slide.label ? "text-base font-medium" : "text-lg font-semibold"}>{slide.text}</p>
        </div>
        <p className="text-sm text-white/70">This can take a few minutes, so please be patient and keep this page open.</p>
      </div>
    </div>
  );
}

export function ManualLink() {
  return (
    <Link href="/account/leagues/new?manual=1" className="block text-center text-sm text-zinc-500 underline">
      No link? Set it up by hand
    </Link>
  );
}
