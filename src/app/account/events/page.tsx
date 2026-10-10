import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentManager } from "@/lib/session";
import { managedLeagues } from "@/lib/my-leagues";
import { formatIsoDate } from "@/lib/time";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "My events · Sidelnr", robots: { index: false } };

const isIsoDate = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export default async function MyEventsPage() {
  const manager = await currentManager();
  if (!manager) redirect("/login?next=/account/events");
  const events = (await managedLeagues(manager.id)).filter((l) => l.isEvent);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="text-zinc-900" />
        <span>
          <Link href="/account" className="underline">
            My teams
          </Link>{" "}
          ·{" "}
          <Link href="/account/leagues" className="underline">
            My leagues
          </Link>
        </span>
      </div>
      <div>
        <h1 className="text-xl font-semibold">My events</h1>
        <p className="text-sm text-zinc-500">
          One-day carnivals and gala days: pools, a draw across your pitches, finals, and a live results page for everyone
          on the day.
        </p>
      </div>

      <Link href="/account/events/new" className="block rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-on-accent">
        + Create an event
      </Link>

      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
          You don’t run any events yet.
        </p>
      ) : (
        events.map((e) => {
          const date = e.competitions.map((c) => c.season).find(isIsoDate);
          const tz = e.competitions[0].league.timezone || undefined;
          return (
            <section key={e.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-semibold">{e.name}</div>
                {date && <div className="shrink-0 text-xs text-zinc-500">{formatIsoDate(date, tz)}</div>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {e.competitions.map((c) => (
                  <Link key={c.id} href={`/account/competitions/${c.id}`} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
                    {c.name} →
                  </Link>
                ))}
              </div>
              <Link href={`/events/${e.id}`} className="mt-3 block text-sm text-zinc-500 underline">
                Public results page ↗
              </Link>
            </section>
          );
        })
      )}
    </div>
  );
}
