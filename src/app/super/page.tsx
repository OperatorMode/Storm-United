import type { Metadata } from "next";
import { Card } from "@/components/Card";
import { SuperLogin } from "./SuperLogin";
import { Housekeeping } from "./Housekeeping";
import { OwnerButton } from "./OwnerButton";
import { LeagueLinks } from "./LeagueLinks";
import { cleanupCounts, databaseUsage } from "@/lib/housekeeping";
import { OwnerLogin } from "./OwnerLogin";
import { ownerLoginAvailable } from "@/lib/owner-auth";
import {
  decideLeagueReview,
  markFeedback,
  ownerDeleteManager,
  ownerRemoveLeagueAdmin,
  ownerRemoveManager,
  ownerResetPin,
  makeLeagueOfficial,
  ownerRefreshLeague,
  removeLeagueVerification,
  removeTeam,
  superLogout,
} from "./actions";
import { FEEDBACK_KINDS, listFeedback, type Feedback } from "@/lib/feedback";
import { pendingReviews } from "@/lib/league-verify";
import { getManager, managedTeams, teamManagerIds } from "@/lib/accounts";
import { leagueAdminIds, managerByEmail, maskEmail } from "@/lib/owner-tools";
import { listLeagues, listTeams } from "@/lib/store";
import { isSuperAdmin } from "@/lib/session";
import { competitionLabel, listCompetitions } from "@/lib/league";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Developer · Sidelnr", robots: { index: false } };

// Refreshing a league re-reads its website, which can take a minute or two.
export const maxDuration = 300;

// The Sidelnr app developer's page ("owner" in the code; teams belong to their managers and families): the bare minimum. Teams and events are run by their
// families and coaches, so nothing here shows what's inside them (players,
// guests, answers, chat, messages), and the developer has no way into them. It can
// only step in: delete a team, event or manager account, take a manager or
// league admin off, reset a team PIN. Everything else stays on the server.
export default async function SuperPage({ searchParams }: PageProps<"/super">) {
  if (!(await isSuperAdmin())) {
    return (
      <div className="mx-auto max-w-md p-4 pt-10">
        <Card title="Developer sign-in">
          {ownerLoginAvailable() && <OwnerLogin />}
          {process.env.ADMIN_PIN?.trim() &&
            (ownerLoginAvailable() ? (
              <details className="mt-5 border-t border-zinc-100 pt-3">
                <summary className="cursor-pointer text-xs text-zinc-500">Use the developer PIN instead</summary>
                <div className="mt-3">
                  <SuperLogin twoStep={!!process.env.OWNER_EMAIL?.trim()} />
                </div>
              </details>
            ) : (
              <SuperLogin twoStep={!!process.env.OWNER_EMAIL?.trim()} />
            ))}
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const email = typeof params.email === "string" ? params.email.trim() : "";
  const lq = typeof params.league === "string" ? params.league.trim() : "";

  const [teams, competitions, leagues, reviews, feedback, usage, counts] = await Promise.all([
    listTeams(),
    listCompetitions(),
    listLeagues(),
    pendingReviews(),
    listFeedback(),
    databaseUsage(),
    cleanupCounts(),
  ]);
  const emailOf = async (managerId: string) => (await getManager(managerId))?.email ?? null;
  const withEmails = async (ids: string[]) => Promise.all(ids.map(async (id) => ({ id, email: await emailOf(id) })));
  // Who asked for each review: they wrote to Sidelnr, so their email shows.
  const reviewers = Object.fromEntries(await Promise.all(reviews.map(async (r) => [r.manager_id, await emailOf(r.manager_id)] as const)));
  const labelOf = (id: string | null) => {
    const c = competitions.find((x) => x.id === id);
    return c ? competitionLabel(c) : null;
  };
  const isEventRow = (t: { kind?: string }) => t.kind === "event";
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  // Teams and events: found by name or link, never listed.
  const needle = q.toLowerCase();
  const found = q ? teams.filter((t) => t.name.toLowerCase().includes(needle) || t.id.includes(needle)).slice(0, 20) : [];
  const foundManagers = Object.fromEntries(await Promise.all(found.map(async (t) => [t.id, await withEmails(await teamManagerIds(t.id))] as const)));
  const official = leagues.filter((l) => l.verified_at);
  // Any league, found by name: to make it official (or see that it already is).
  const lneedle = lq.toLowerCase();
  const foundLeagues = lq
    ? leagues.filter((l) => [l.name, l.short_name, l.id, l.website].some((v) => v?.toLowerCase().includes(lneedle))).slice(0, 10)
    : []; // by name, short name ("NBL") or website
  const foundLeagueAdmins = Object.fromEntries(await Promise.all(foundLeagues.map(async (l) => [l.id, await withEmails(await leagueAdminIds(l.id))] as const)));
  const verifiedLabel = (by?: string | null) => (by === "review" ? "Approved by review" : by === "owner" ? "Made official by you" : `Verified with ${by}`);
  const officialAdmins = Object.fromEntries(await Promise.all(official.map(async (l) => [l.id, await withEmails(await leagueAdminIds(l.id))] as const)));
  const account = email ? await managerByEmail(email) : null;
  const accountTeams = account ? await managedTeams(account.id) : [];
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const masked = (e: string | null) => (e ? maskEmail(e) : "Unknown");

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between">
        <SidelnrLink className="" />
        <form action={superLogout}>
          <button className="text-sm text-zinc-500">Lock</button>
        </form>
      </div>
      <div>
        <h1 className="text-lg font-semibold">Developer</h1>
        <p className="text-sm text-zinc-500">
          Teams and events belong to their families and coaches, so you can’t see inside them. Here you can only step in: delete,
          take a manager off, or reset a PIN.
        </p>
      </div>

      <Card title="Feedback" aside={feedback.open.length ? `${feedback.open.length} new` : undefined}>
        <div className="space-y-3 text-sm">
          {feedback.open.map((f) => (
            <FeedbackItem key={f.id} f={f} />
          ))}
          {!feedback.open.length && <p className="text-zinc-500">Nothing new.</p>}
          {feedback.done.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-zinc-500">Done ({feedback.done.length})</summary>
              <div className="mt-2 space-y-3">
                {feedback.done.map((f) => (
                  <FeedbackItem key={f.id} f={f} />
                ))}
              </div>
            </details>
          )}
        </div>
      </Card>

      <Card title="Teams and events" aside={`${count(teams.filter((t) => !isEventRow(t)).length, "team")} · ${count(teams.filter(isEventRow).length, "event")}`}>
        <form className="flex gap-2 text-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or link, e.g. riverside-rockets"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-base"
          />
          <button className="rounded-xl bg-zinc-900 px-4 font-semibold text-white">Find</button>
        </form>
        {q && (
          <ul className="mt-3 space-y-3 text-sm">
            {found.map((t) => {
              const event = isEventRow(t);
              const managers = foundManagers[t.id] ?? [];
              return (
                <li key={t.id} className="space-y-2 rounded-xl bg-zinc-50 p-3">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-zinc-500">{[event ? "Event" : "Team", labelOf(t.competition_id), `/${t.id}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-zinc-500">{event ? "Organiser accounts" : "Manager accounts"}</div>
                    {managers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2">
                        <span>{masked(m.email)}</span>
                        <OwnerButton
                          label="Take off"
                          question={`Take ${masked(m.email)} off ${t.name}? The ${event ? "event" : "team"} carries on.`}
                          action={ownerRemoveManager.bind(null, t.id, m.id)}
                        />
                      </div>
                    ))}
                    {!managers.length && <div className="text-xs text-zinc-500">None</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-2">
                    {t.admin_pin_hash ? (
                      <OwnerButton
                        label={event ? "Reset organiser code" : "Reset team PIN"}
                        question={`Clear the ${event ? "organiser code" : "team PIN"} of ${t.name}? Everyone who unlocked with it is locked out. Manager accounts keep working.`}
                        action={ownerResetPin.bind(null, t.id)}
                      />
                    ) : (
                      <span className="text-xs text-zinc-500">{event ? "No organiser code" : "No team PIN"}</span>
                    )}
                    <span className="ml-auto">
                      <OwnerButton
                        danger
                        label={event ? "Delete event" : "Delete team"}
                        question={`Delete ${t.name} for everyone, with everything in it? This can’t be undone.`}
                        typeName={t.name}
                        action={removeTeam.bind(null, t.id)}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
            {!found.length && <li className="text-zinc-500">Nothing found for “{q}”.</li>}
          </ul>
        )}
      </Card>

      <Card title="Manager accounts">
        <form className="flex gap-2 text-sm">
          <input
            name="email"
            type="email"
            defaultValue={email}
            placeholder="Their sign-in email"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-base"
          />
          <button className="rounded-xl bg-zinc-900 px-4 font-semibold text-white">Find</button>
        </form>
        <p className="mt-1 text-xs text-zinc-500">For when someone asks to be taken off a team, or to have their account deleted.</p>
        {email &&
          (account ? (
            <div className="mt-3 space-y-2 rounded-xl bg-zinc-50 p-3 text-sm">
              <div className="font-semibold">{account.email}</div>
              {accountTeams.map((l) => (
                <div key={l.team_id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {nameOf(l.team_id)} <span className="text-xs text-zinc-500">· {l.role === "owner" ? "Owner" : "Manager"}</span>
                  </span>
                  <OwnerButton
                    label="Take off"
                    question={`Take ${account.email} off ${nameOf(l.team_id)}? It carries on without them.`}
                    action={ownerRemoveManager.bind(null, l.team_id, account.id)}
                  />
                </div>
              ))}
              {!accountTeams.length && <div className="text-xs text-zinc-500">Not managing any team or event.</div>}
              <div className="border-t border-zinc-200 pt-2 text-right">
                <OwnerButton
                  danger
                  label="Delete account"
                  question={`Delete the account ${account.email}? Their teams and leagues carry on without them.`}
                  typeName={account.email}
                  action={ownerDeleteManager.bind(null, account.id)}
                />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No account with that email.</p>
          ))}
      </Card>

      <Card title="Official leagues" aside={reviews.length ? `${reviews.length} to review` : undefined}>
        <form className="mb-3 flex gap-2 text-sm">
          <input
            name="league"
            defaultValue={lq}
            placeholder="Find any league, e.g. WNBL"
            className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-base"
          />
          <button className="rounded-xl bg-zinc-900 px-4 font-semibold text-white">Find</button>
        </form>
        {lq && (
          <div className="mb-4 space-y-2 text-sm">
            {foundLeagues.map((l) => (
              <div key={l.id} className="space-y-2 rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {l.verified_at ? "✓ " : ""}
                    {l.name}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {l.verified_at ? verifiedLabel(l.verified_by) : "Not official"} · Admins:{" "}
                    {(foundLeagueAdmins[l.id] ?? []).map((a) => masked(a.email)).join(", ") || "none"}
                  </span>
                </span>
                <OwnerButton
                  label="Refresh now"
                  question={`Read ${l.name}’s fixtures and ladder from its website again now? It can take a minute or two.`}
                  action={ownerRefreshLeague.bind(null, l.id)}
                />
                {l.verified_at ? (
                  <OwnerButton label="Not official" question={`Take the official tick off ${l.name}?`} action={removeLeagueVerification.bind(null, l.id)} />
                ) : (
                  <OwnerButton
                    label="Make official"
                    question={`Make ${l.name} official? It gets the tick, and its admins can post to every team in it.`}
                    action={makeLeagueOfficial.bind(null, l.id)}
                  />
                )}
              </div>
              {competitions.some((c) => c.league_id === l.id && c.feed_url) && (
                <LeagueLinks
                  competitions={competitions
                    .filter((c) => c.league_id === l.id && c.feed_url)
                    .map((c) => ({ id: c.id, name: c.name, feedUrl: c.feed_url ?? "", ladderUrl: c.ladder_url ?? "" }))}
                />
              )}
              </div>
            ))}
            {!foundLeagues.length && <p className="text-zinc-500">No league found for “{lq}”.</p>}
          </div>
        )}
        <div className="space-y-4 text-sm">
          {reviews.map((r) => (
            <div key={r.id} className="space-y-2 rounded-xl bg-amber-50 p-3">
              <div className="font-semibold">{leagues.find((l) => l.id === r.league_id)?.name ?? r.league_id}</div>
              <div className="text-xs text-zinc-600">
                From {reviewers[r.manager_id] ?? "unknown"} · {r.created_at.slice(0, 10)}
              </div>
              <p className="whitespace-pre-wrap break-words">{r.note}</p>
              <div className="flex gap-2">
                <form action={decideLeagueReview.bind(null, r.id, true)}>
                  <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                </form>
                <form action={decideLeagueReview.bind(null, r.id, false)}>
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs">Decline</button>
                </form>
              </div>
            </div>
          ))}
          {official.map((l) => (
            <div key={l.id} className="space-y-1.5 rounded-xl bg-zinc-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">✓ {l.name}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {verifiedLabel(l.verified_by)}
                  </span>
                </span>
                <OwnerButton label="Not official" question={`Take the official tick off ${l.name}?`} action={removeLeagueVerification.bind(null, l.id)} />
              </div>
              {(officialAdmins[l.id] ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>Admin: {masked(a.email)}</span>
                  <OwnerButton
                    label="Take off"
                    question={`Take ${masked(a.email)} off ${l.name}?`}
                    action={ownerRemoveLeagueAdmin.bind(null, l.id, a.id)}
                  />
                </div>
              ))}
            </div>
          ))}
          {!reviews.length && !official.length && <p className="text-zinc-500">No official leagues yet.</p>}
        </div>
      </Card>

      <Card title="Housekeeping" aside={usage.databaseBytes !== null ? `${Math.round(usage.databaseBytes / 1024 / 1024)} MB used` : undefined}>
        <Housekeeping databaseBytes={usage.databaseBytes} tables={usage.tables} counts={counts} />
      </Card>
    </div>
  );
}

function FeedbackItem({ f }: { f: Feedback }) {
  return (
    <div className={`space-y-1 rounded-xl p-3 ${f.done ? "bg-zinc-50 text-zinc-500" : f.kind === "bug" ? "bg-red-50" : "bg-sky-50"}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide">{FEEDBACK_KINDS[f.kind] ?? f.kind}</span>
        <span className="text-zinc-500">{f.created_at.slice(0, 10)}</span>
      </div>
      <p className="whitespace-pre-wrap break-words">{f.message}</p>
      <div className="text-xs text-zinc-500">{[f.page, f.device].filter(Boolean).join(" · ")}</div>
      <div className="flex items-center gap-3 pt-1 text-xs">
        {f.email && (
          <a href={`mailto:${f.email}?subject=${encodeURIComponent("Re: your Sidelnr feedback")}`} className="underline">
            Reply to {f.email}
          </a>
        )}
        <form action={markFeedback.bind(null, f.id, !f.done)} className="ml-auto">
          <button className="rounded-lg border border-zinc-300 px-2 py-1">{f.done ? "Open again" : "Mark done"}</button>
        </form>
      </div>
    </div>
  );
}
