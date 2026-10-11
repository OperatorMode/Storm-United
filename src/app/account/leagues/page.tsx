import type { Metadata } from "next";
import Link from "next/link";
import { CARNIVALS_ENABLED } from "@/lib/features";
import { redirect } from "next/navigation";
import { currentManager } from "@/lib/session";
import { managedLeagues } from "@/lib/my-leagues";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "My leagues · Sidelnr", robots: { index: false } };

// Reading a league's website can take a while.
export const maxDuration = 300;

export default async function MyLeaguesPage() {
  const manager = await currentManager();
  if (!manager) redirect("/login?next=/account/leagues");
  const leagues = (await managedLeagues(manager.id)).filter((l) => !l.isEvent);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="text-zinc-900" />
        <span>
          <Link href="/account" className="underline">
            My teams
          </Link>
          {CARNIVALS_ENABLED && (
            <>
              {" "}
              ·{" "}
              <Link href="/account/events" className="underline">
                My events
              </Link>
            </>
          )}
        </span>
      </div>
      <div>
        <h1 className="text-xl font-semibold">My leagues</h1>
        <p className="text-sm text-zinc-500">
          Run your own league: a social or hobby comp, a club or school competition. You add the teams, fixtures (typed,
          uploaded, from your own spreadsheet or made for you) and results, and every Sidelnr team in it gets them.
        </p>
      </div>

      {leagues.length > 0 && (
        <Link href="/account/leagues/new" className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-on-accent">
          + Run a league
        </Link>
      )}

      {leagues.length === 0 ? (
        <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-600">
            <b className="text-zinc-900">Your league is on a website or an app?</b> You don’t need to add it here.{" "}
            <Link href="/account/new" className="font-medium text-zinc-900 underline">
              Set up your team
            </Link>{" "}
            and Sidelnr finds its games and keeps them up to date by itself.
          </p>
          <Link href="/account/leagues/new" className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-on-accent">
            Run a league
          </Link>
        </section>
      ) : (
        leagues.map((l) => (
          <section key={l.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="font-semibold">{l.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {l.competitions.map((c) => (
                <Link key={c.id} href={`/account/competitions/${c.id}`} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
                  {c.name} →
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
