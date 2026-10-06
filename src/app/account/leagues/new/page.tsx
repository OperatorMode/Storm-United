import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewLeagueForm } from "../LeagueForms";
import { currentManagerId } from "@/lib/session";

export const metadata: Metadata = { title: "Add your league · Sidelnr", robots: { index: false } };

export default async function NewLeaguePage() {
  if (!(await currentManagerId())) redirect("/login?next=/account/leagues/new");
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <Link href="/account/leagues" className="text-sm text-zinc-500">
        ← My leagues
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Add your league</h1>
        <p className="mt-1 text-sm text-zinc-500">
          For leagues that aren’t on Sidelnr yet: a club comp, a social league, a school competition. You’ll be its league
          admin: you add the teams and fixtures (typed in or uploaded) and enter results, and every Sidelnr team in it
          gets them automatically.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <NewLeagueForm />
      </section>
    </div>
  );
}
