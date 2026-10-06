import Link from "next/link";
import { knownTeamIds } from "@/lib/known-teams";
import { JoinTeamForm, ManagerSignInForm } from "./LandingForms";
import { getTeam } from "@/lib/teams";
import { logoSrc } from "@/lib/brand";
import { currentManager } from "@/lib/session";
import { emailEnabled } from "@/lib/email";

// Landing page with four doors: parents join a team; My Team, My League and My Event
// sign in (one account covers all three). There's deliberately no
// public list of teams. Teams this phone has used before are one-tap shortcuts.

const DOORS = [
  {
    href: "/account",
    title: "My Team",
    text: "For coaches and managers: your team, attendance, MVP and messages.",
  },
  {
    href: "/account/leagues",
    title: "My League",
    text: "For league organisers: teams, fixtures, results and the ladder.",
  },
  {
    href: "/account/events",
    title: "My Event",
    text: "For carnivals and gala days: pools, finals and live results.",
  },
] as const;

export default async function Landing() {
  const ids = await knownTeamIds();
  const [known, manager] = await Promise.all([
    Promise.all(ids.map((id) => getTeam(id))).then((ts) => ts.filter((t) => t !== null)),
    currentManager(),
  ]);
  const signIn = (next: string) => (emailEnabled() ? `/login?next=${encodeURIComponent(next)}` : next);

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
            {known.map((t) => (
              <Link key={t.id} href={`/${t.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-zinc-950 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc(t)} alt="" className="size-10 shrink-0 object-contain" />
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className="text-sm text-zinc-500">Continue →</span>
              </Link>
            ))}
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 text-zinc-950 shadow-lg">
          <h2 className="font-semibold">Join your team</h2>
          <p className="mb-3 mt-0.5 text-sm text-zinc-500">Parents and players: enter the team code from your coach.</p>
          <JoinTeamForm />
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Managers</h2>
            {manager && <span className="text-xs opacity-60">Signed in as {manager.email}</span>}
          </div>
          {DOORS.map((d) => (
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

        <p className="text-center text-xs opacity-50">
          Fixtures, attendance, MVP votes, team chat and live ladders for any team sport.
        </p>
      </div>
    </div>
  );
}
