"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { importLeagueAction, scanLeagueAction } from "./actions";
import { TimezoneSelect } from "./LeagueForms";
import type { LeagueScan } from "@/lib/league-scan";

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";
const SCANNING = [
  "Opening the page…",
  "Looking for the fixtures…",
  "Working out the competitions…",
  "Counting the teams…",
  "Still reading, big pages take a little longer…",
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
  const [pending, start] = useTransition();

  const find = () =>
    start(async () => {
      setError(null);
      setStage("scanning");
      const res = await scanLeagueAction(url);
      if (res.error || !res.scan) {
        setError(res.error ?? "Couldn’t read that link.");
        setStage("link");
        return;
      }
      setScan(res.scan);
      setLeagueName(res.scan.leagueName);
      setCompetition(res.scan.competitions.length === 1 ? res.scan.competitions[0].name : "");
      setStage("found");
    });

  const doImport = (form: FormData) =>
    start(async () => {
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
        competition,
        filter: scan.competitions.length > 1,
      });
      if (res.competitionId) {
        router.push(`/account/competitions/${res.competitionId}?new=1`);
        return;
      }
      setError(res.error ?? "Something went wrong.");
      setStage("found");
    });

  if (stage === "scanning" || stage === "importing") {
    return <Working messages={stage === "scanning" ? SCANNING : IMPORTING} />;
  }

  if (stage === "found" && scan) {
    const many = scan.competitions.length > 1;
    const chosen = scan.competitions.find((c) => c.name === competition);
    return (
      <form action={doImport} className="space-y-4 text-sm">
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
            <button disabled={pending || (many && !competition)} className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30">
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
        <button disabled={pending || !url.trim()} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent disabled:opacity-40">
          Find my league
        </button>
        <p className="text-xs text-zinc-500">A website, a Google Sheet or a calendar link all work. This can take a minute or two.</p>
      </form>
      {error && <p className="text-accent">{error}</p>}
    </div>
  );
}

// The spinner with messages that change as it works.
function Working({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), 6000);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <svg className="size-10 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="font-medium" aria-live="polite">
        {messages[i]}
      </p>
      <p className="text-xs text-zinc-500">This can take a minute or two. Please keep this page open.</p>
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
