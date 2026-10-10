import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewLeagueForm } from "../LeagueForms";
import { MagicImport, ManualLink } from "../MagicImport";
import { currentManagerId } from "@/lib/session";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Add your league · Sidelnr", robots: { index: false } };

// Reading a league's website (and opening it in a browser) can take a while.
export const maxDuration = 300;

export default async function NewLeaguePage({ searchParams }: PageProps<"/account/leagues/new">) {
  if (!(await currentManagerId())) redirect("/login?next=/account/leagues/new");
  const manual = (await searchParams).manual !== undefined;

  if (!manual) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
          <SidelnrLink className="text-zinc-900" />
          <Link href="/account/leagues">← My leagues</Link>
        </div>
        <div>
          <h1 className="text-xl font-semibold">Got a league website?</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Let’s see what we can pull. Paste the league’s link and Sidelnr finds the competitions, teams and fixtures,
            and keeps results up to date from there.
          </p>
        </div>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <MagicImport />
        </section>
        <ManualLink />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="text-zinc-900" />
        <Link href="/account/leagues/new">← Import from a link instead</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Add your league</h1>
        <p className="mt-1 text-sm text-zinc-500">
          For leagues that aren’t on Sidelnr yet: a club comp, a social league, a school competition. You’ll be its league
          admin: you add the teams and fixtures (typed in, uploaded or created automatically) and enter results, and every
          Sidelnr team in it gets them automatically.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <NewLeagueForm />
      </section>
    </div>
  );
}
