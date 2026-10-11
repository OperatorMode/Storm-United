"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { TeamForm } from "@/components/TeamForm";
import { MagicImport } from "./leagues/MagicImport";
import { competitionLabelAction, findLeagueAction, findTeamAction, searchOnlineAction, type LeagueHit, type TeamHit } from "./setup-actions";
import type { LeagueCandidate } from "@/lib/league-search";

// "Set up your team", one question at a time. First look for the team (and then
// its league) among what Sidelnr already has. If it's not there, find where its
// games are published, in this order: a website link, a web search by the
// league's name, the app they use, an online spreadsheet or calendar, a file,
// and last, typing the games in (a league you run, under My League).

type Step = "team" | "league" | "link" | "search" | "app" | "sheet" | "file" | "details";
const FINDING: Step[] = ["team", "league", "link", "search", "app", "sheet", "file"];
type Picked = { competitionId: string; label: string; team?: string };
type SaveResult = { error?: string } | null | undefined;

const field = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base";
const primary = "w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-30";
const next = "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-medium text-zinc-700";

export function SetupTeam({ save, start }: { save: (prev: SaveResult, formData: FormData) => Promise<SaveResult>; start: Picked | null }) {
  const [history, setHistory] = useState<Step[]>([start ? "details" : "team"]);
  const step = history[history.length - 1];
  const go = (s: Step) => setHistory((h) => [...h, s]);
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  const [picked, setPicked] = useState<Picked | null>(start);
  const [linkFromSearch, setLinkFromSearch] = useState("");
  const choose = (p: Picked) => {
    setPicked(p);
    go("details");
  };
  // Just imported: look up its name for the team step.
  const imported = async (competitionId: string) => choose({ competitionId, label: await competitionLabelAction(competitionId) });
  const n = FINDING.indexOf(step);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        {history.length > 1 ? (
          <button type="button" onClick={back} className="text-zinc-600 underline">
            ← Back
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-zinc-500">{step === "details" ? "Last step" : `Step ${n + 1}`}</span>
      </div>
      {step !== "details" && (
        <div className="flex gap-1" aria-hidden>
          {FINDING.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= n ? "bg-zinc-900" : "bg-zinc-200"}`} />
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {step === "team" && <FindTeam onPick={choose} onNotThere={() => go("league")} />}
        {step === "league" && <FindLeague onPick={choose} onNotThere={() => go("link")} />}
        {step === "link" && (
          <Ask title="Add your fixtures and ladder" text="Paste the website where you check your games: your club’s or association’s site, or the page with the draw or the ladder.">
            <MagicImport
              key={linkFromSearch}
              initialUrl={linkFromSearch}
              onImported={imported}
              onAlready={(id, label) => choose({ competitionId: id, label })}
            />
            <button type="button" onClick={() => go("search")} className={`${next} mt-3`}>
              I don’t have a link
            </button>
          </Ask>
        )}
        {step === "search" && (
          <SearchOnline
            onPick={(url) => {
              setLinkFromSearch(url);
              go("link");
            }}
            onNotThere={() => go("app")}
          />
        )}
        {step === "app" && (
          <PickApp
            onLink={() => {
              setLinkFromSearch("");
              go("link");
            }}
            onNotThere={() => go("sheet")}
          />
        )}
        {step === "sheet" && (
          <Ask
            title="Is the draw in an online spreadsheet or calendar?"
            text="A Google Sheet (shared so anyone with the link can view it) or a calendar link (.ics, webcal) works. Paste its link."
          >
            <MagicImport onImported={imported} onAlready={(id, label) => choose({ competitionId: id, label })} />
            <button type="button" onClick={() => go("file")} className={`${next} mt-3`}>
              No, it’s a file or on paper
            </button>
          </Ask>
        )}
        {step === "file" && (
          <Ask
            title="Set up your league yourself"
            text="Got the draw as a file (Excel or CSV)? Upload it. Only on paper? Type the teams and games in, or let Sidelnr make a draw. It becomes your league under My League, and other teams in it can join."
          >
            <div className="space-y-2">
              <Link href="/account/leagues/new?manual=1" className={`${primary} block text-center`}>
                Set up my league
              </Link>
              <p className="text-xs text-zinc-500">Then come back here and pick your team in it.</p>
            </div>
          </Ask>
        )}
        {step === "details" && picked && (
          <Ask title="Your team" text="Check your team in the draw, then add your colours and players.">
            <TeamForm competitionLabel={picked.label || null} startCompetitionId={picked.competitionId} startTeam={picked.team} initial={null} save={save} />
          </Ask>
        )}
      </section>
    </div>
  );
}

function Ask({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-zinc-500">{text}</p>
      </div>
      {children}
    </div>
  );
}

/** Step 1: your team, in the leagues Sidelnr already has. */
function FindTeam({ onPick, onNotThere }: { onPick: (p: Picked) => void; onNotThere: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TeamHit[] | null>(null);
  const [pending, start] = useTransition();
  return (
    <Ask title="What’s your team called?" text="As it’s written in the draw, e.g. “Riverside Rockets” or “Rockets U10”.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setHits((await findTeamAction(q)).hits));
        }}
        className="flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team name" className={field} autoFocus />
        <button disabled={pending || q.trim().length < 2} className="shrink-0 rounded-xl bg-zinc-900 px-4 font-semibold text-white disabled:opacity-30">
          {pending ? "…" : "Find"}
        </button>
      </form>
      {hits && (
        <div className="space-y-2">
          {hits.length > 0 && <p className="font-medium">Is this your team?</p>}
          {hits.map((h) => (
            <button
              key={`${h.competitionId}:${h.team}`}
              type="button"
              disabled={h.taken}
              onClick={() => onPick({ competitionId: h.competitionId, label: h.label, team: h.team })}
              className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-left disabled:opacity-50"
            >
              <span className="block font-medium">{h.team}</span>
              <span className="block text-xs text-zinc-500">{h.taken ? `${h.label} · already on Sidelnr: ask its manager to add you` : h.label}</span>
            </button>
          ))}
          <button type="button" onClick={onNotThere} className={next}>
            {hits.length ? "None of these" : "Not found. Next"}
          </button>
        </div>
      )}
    </Ask>
  );
}

/** Step 2: your league, by name. */
function FindLeague({ onPick, onNotThere }: { onPick: (p: Picked) => void; onNotThere: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<LeagueHit[] | null>(null);
  const [pending, start] = useTransition();
  return (
    <Ask title="Which league do you play in?" text="Maybe your league is on Sidelnr under a different team name. Type its name, e.g. “Football South Coast” or “Riverside Junior League”.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setHits((await findLeagueAction(q)).hits));
        }}
        className="flex gap-2"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="League name" className={field} autoFocus />
        <button disabled={pending || q.trim().length < 2} className="shrink-0 rounded-xl bg-zinc-900 px-4 font-semibold text-white disabled:opacity-30">
          {pending ? "…" : "Find"}
        </button>
      </form>
      {hits && (
        <div className="space-y-2">
          {hits.length > 0 && <p className="font-medium">Which competition?</p>}
          {hits.map((h) => (
            <button
              key={h.competitionId}
              type="button"
              onClick={() => onPick({ competitionId: h.competitionId, label: h.label })}
              className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-left"
            >
              <span className="block font-medium">{h.label}</span>
              {h.detail && <span className="block text-xs text-zinc-500">{h.detail}</span>}
            </button>
          ))}
          <button type="button" onClick={onNotThere} className={next}>
            {hits.length ? "None of these" : "Not on Sidelnr yet. Next"}
          </button>
        </div>
      )}
      {!hits && (
        <button type="button" onClick={onNotThere} className="w-full text-center text-zinc-500 underline">
          It’s not on Sidelnr yet
        </button>
      )}
    </Ask>
  );
}

/** Step 4: no link? Search the web by the league's name. */
function SearchOnline({ onPick, onNotThere }: { onPick: (url: string) => void; onNotThere: () => void }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [found, setFound] = useState<LeagueCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Ask title="Let’s look it up" text="Tell us the league’s name and where it plays, and Sidelnr searches the web for its fixtures.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const res = await searchOnlineAction(name, area);
            if (res.error) return setError(res.error);
            setFound(res.candidates ?? []);
          });
        }}
        className="space-y-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="League name, e.g. Football South Coast" className={field} />
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Where, e.g. Wollongong NSW" className={field} />
        <button disabled={pending || name.trim().length < 3} className={primary}>
          {pending ? "Searching… (up to a minute)" : "Search"}
        </button>
      </form>
      {error && <p className="text-accent">{error}</p>}
      {found && (
        <div className="space-y-2">
          {found.length > 0 ? <p className="font-medium">Is it one of these?</p> : <p className="text-zinc-500">Nothing found.</p>}
          {found.map((c) => (
            <button key={c.url} type="button" onClick={() => onPick(c.url)} className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-left">
              <span className="block font-medium">{c.title}</span>
              <span className="block text-xs text-zinc-500">{c.why}</span>
              <span className="block truncate text-xs text-zinc-400">{c.url}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onNotThere} className={next}>
        {found?.length ? "None of these" : "Skip: we use an app"}
      </button>
    </Ask>
  );
}

const APPS: { name: string; tip: string; readable: boolean }[] = [
  {
    name: "PlayHQ",
    tip: "Open playhq.com in a browser (not the app), find your competition or your team’s fixtures, and copy the address from the address bar.",
    readable: true,
  },
  {
    name: "Squadi",
    tip: "Open your association’s fixtures page in a browser (often linked from its website), pick your competition, and copy the address.",
    readable: true,
  },
  { name: "Dribl", tip: "Sidelnr can’t read Dribl yet. Many associations also put the draw on their own website or in a spreadsheet: try those.", readable: false },
  { name: "GameDay / MySideline", tip: "Sidelnr can’t read GameDay yet. Try your association’s website or a spreadsheet instead.", readable: false },
  { name: "Another app", tip: "If the app has a web version, open your draw there and copy the address. If not, try a spreadsheet.", readable: true },
];

/** Step 5: which app do you check your games in? */
function PickApp({ onLink, onNotThere }: { onLink: () => void; onNotThere: () => void }) {
  const [app, setApp] = useState<(typeof APPS)[number] | null>(null);
  return (
    <Ask title="Which app do you check your games in?" text="Many apps also show the draw on a web page Sidelnr can read.">
      <div className="grid gap-2">
        {APPS.map((a) => (
          <button
            key={a.name}
            type="button"
            aria-pressed={app?.name === a.name}
            onClick={() => setApp(a)}
            className={`rounded-xl border px-3 py-2.5 text-left font-medium ${app?.name === a.name ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white"}`}
          >
            {a.name}
          </button>
        ))}
      </div>
      {app && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
          <p>{app.tip}</p>
          {app.readable && (
            <button type="button" onClick={onLink} className={primary}>
              I’ve got the link
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={onNotThere} className={next}>
        {app && !app.readable ? "Try a spreadsheet" : "None of these"}
      </button>
    </Ask>
  );
}
