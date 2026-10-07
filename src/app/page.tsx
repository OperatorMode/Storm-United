import Link from "next/link";
import { knownTeamIds } from "@/lib/known-teams";
import { TeamBadge } from "@/components/TeamBadge";
import { competitionLabel, getCompetition } from "@/lib/league";
import { tabData } from "@/lib/tabs";
import { listChat } from "@/lib/messages";
import { LegalLinks } from "@/components/LegalPage";
import { JoinTeamForm, ManagerSignInForm } from "./LandingForms";
import { firstName, getTeam, playerName } from "@/lib/teams";
import { logoSrc } from "@/lib/brand";
import { chatAuthor, currentChildren, currentManager } from "@/lib/session";
import { emailEnabled } from "@/lib/email";
import { managedTeams } from "@/lib/accounts";
import { managedLeagues } from "@/lib/my-leagues";

// Landing page. Parents join a team; My Team, My League and My Event sign in
// (one account covers all three). There's deliberately no public list of
// teams. Teams this phone has used before are one-tap shortcuts, and so is
// everything a signed-in manager runs: their teams, leagues and events.

const DOORS = [
  {
    key: "teams",
    href: "/account",
    title: "My Team",
    text: "For coaches and managers: your team, attendance, MVP and messages.",
    add: { href: "/account/new", label: "Add a team" },
  },
  {
    key: "leagues",
    href: "/account/leagues",
    title: "My League",
    text: "For league organisers: teams, fixtures, results and the ladder.",
    add: { href: "/account/leagues/new", label: "Add a league" },
  },
  {
    key: "events",
    href: "/account/events",
    title: "My Event",
    text: "For carnivals and gala days: pools, finals and live results.",
    add: { href: "/account/events", label: "Add an event" },
  },
] as const;

type Run = { href: string; title: string; detail: string; logo?: string };

export default async function Landing() {
  const ids = await knownTeamIds();
  const [known, manager] = await Promise.all([
    Promise.all(ids.map((id) => getTeam(id))).then((ts) => ts.filter((t) => t !== null)),
    currentManager(),
  ]);
  const signIn = (next: string) => (emailEnabled() ? `/login?next=${encodeURIComponent(next)}` : next);
  // What a signed-in manager runs, each one tap away.
  const runs: Record<(typeof DOORS)[number]["key"], Run[]> = { teams: [], leagues: [], events: [] };
  if (manager) {
    const [mine, leagues] = await Promise.all([managedTeams(manager.id), managedLeagues(manager.id)]);
    const teams = (await Promise.all(mine.map((m) => getTeam(m.team_id)))).filter((t) => t !== null);
    runs.teams = await Promise.all(
      teams.map(async (t) => {
        const c = t.competition_id ? await getCompetition(t.competition_id) : null;
        return { href: `/${t.id}/admin`, title: t.name, detail: c ? competitionLabel(c) : "Manager’s Corner", logo: logoSrc(t) };
      }),
    );
    for (const l of leagues) {
      const names = l.competitions.map((c) => c.name);
      const run = {
        href: `/account/competitions/${l.competitions[0].id}`,
        title: l.name,
        detail: names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", "),
      };
      (l.isEvent ? runs.events : runs.leagues).push(run);
    }
  }
  // Each team: its competition, which of this phone's kids play in it, and what's new.
  const rows = await Promise.all(
    known.map(async (t) => {
      const [competition, children, tabs, me, chat] = await Promise.all([
        t.competition_id ? getCompetition(t.competition_id) : Promise.resolve(null),
        currentChildren(t),
        tabData(t),
        chatAuthor(t),
        listChat(t.id).catch(() => []),
      ]);
      return {
        team: t,
        league: competition ? competitionLabel(competition) : t.division,
        kids: children.map((c) => firstName(playerName(t, c))),
        boardUnread: tabs.boardUnread,
        chatTimes: chat.filter((m) => m.author_id !== me).slice(-50).map((m) => m.created_at),
      };
    }),
  );

  return (
    <div className="jersey min-h-dvh px-4 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sidelnr<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm font-medium opacity-80">Your team, on the sideline.</p>
        </div>

        {known.length > 0 && (
          <div className="space-y-2">
            <Link href="/me" className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-on-accent shadow-lg">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">My Player</span>
                <span className="block text-xs opacity-80">All your games in one place: when, where and directions.</span>
              </span>
              <span aria-hidden>→</span>
            </Link>
            {rows.map(({ team: t, league, kids, boardUnread, chatTimes }) => (
              <Link key={t.id} href={`/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-zinc-950 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc(t)} alt="" className="size-10 shrink-0 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{league}</span>
                  {kids.length > 0 && <span className="block truncate text-xs font-medium text-zinc-700">{kids.join(" & ")}</span>}
                </span>
                <TeamBadge teamId={t.id} boardUnread={boardUnread} chatTimes={chatTimes} />
                <span className="text-zinc-400" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        )}

        {DOORS.filter((d) => runs[d.key].length > 0).map((d) => (
          <section key={d.key} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">{d.title}</h2>
              <Link href={d.add.href} className="text-xs font-medium underline opacity-80">
                + {d.add.label}
              </Link>
            </div>
            {runs[d.key].map((r) => (
              <Link key={r.href} href={r.href} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-zinc-950 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.logo && <img src={r.logo} alt="" className="size-10 shrink-0 object-contain" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{r.detail}</span>
                </span>
                <span className="text-zinc-400" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </section>
        ))}

        <section className="rounded-2xl bg-white p-5 text-zinc-950 shadow-lg">
          <h2 className="font-semibold">Join your team</h2>
          <p className="mb-3 mt-0.5 text-sm text-zinc-500">Parents and players: enter the team code from your coach.</p>
          <JoinTeamForm />
        </section>

        {DOORS.some((d) => !runs[d.key].length) && (
          <section className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Managers</h2>
              {manager && <span className="text-xs opacity-60">Signed in as {manager.email}</span>}
            </div>
            {DOORS.filter((d) => !runs[d.key].length).map((d) => (
              <Link
                key={d.href}
                href={manager ? d.href : signIn(d.href)}
                className="flex items-center gap-3 rounded-2xl bg-white/95 p-4 text-zinc-950 shadow-lg"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{d.title}</span>
                  <span className="block text-xs text-zinc-500">{d.text}</span>
                </span>
                <span className="text-zinc-400">→</span>
              </Link>
            ))}
            {!manager && (
              <details className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-zinc-950 shadow-lg">
                <summary className="cursor-pointer text-zinc-600">Team manager with a team PIN?</summary>
                <div className="mt-3">
                  <ManagerSignInForm />
                </div>
              </details>
            )}
          </section>
        )}

        <p className="text-center text-xs opacity-50">
          Fixtures, attendance, MVP votes, team chat and live ladders for any team sport.
        </p>
        <LegalLinks className="opacity-60" />
      </div>
    </div>
  );
}
