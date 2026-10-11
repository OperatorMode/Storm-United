import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewLeagueForm } from "../LeagueForms";
import { currentManagerId } from "@/lib/session";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Run a league · Sidelnr", robots: { index: false } };

export const maxDuration = 300;

// "Run a league": a league you set up and run yourself (My League). Leagues on
// a website or an app aren't added here: team setup finds and reads them.
export default async function NewLeaguePage() {
  if (!(await currentManagerId())) redirect("/login?next=/account/leagues/new");
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="" />
        <Link href="/account/leagues">← My leagues</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Run a league</h1>
        <p className="mt-1 text-sm text-zinc-500">
          For a league you run yourself: a social or hobby comp, a club or school competition. You’ll be its league admin: you
          add the teams and fixtures (typed in, uploaded or made for you) and enter results, and every Sidelnr team in it gets
          them.
        </p>
      </div>
      <p className="rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
        Your league is on a website or an app?{" "}
        <Link href="/account/new" className="font-medium text-zinc-900 underline">
          Set up your team
        </Link>{" "}
        instead: Sidelnr finds its games by itself.
      </p>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <NewLeagueForm />
      </section>
    </div>
  );
}
