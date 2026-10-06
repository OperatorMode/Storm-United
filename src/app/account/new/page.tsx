import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamForm } from "@/components/TeamForm";
import { createMyTeam } from "../team-actions";
import { currentManagerId } from "@/lib/session";

export const metadata: Metadata = { title: "Create a team · Sidelnr", robots: { index: false } };

export default async function NewTeamPage() {
  if (!(await currentManagerId())) redirect("/login?next=/account/new");
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <Link href="/account" className="text-sm text-zinc-500">
        ← My teams
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Create a team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick your competition and your team in its draw. Fixtures, results and the ladder then load automatically.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <TeamForm competitionLabel={null} initial={null} save={createMyTeam} />
      </section>
      <p className="text-center text-sm text-zinc-500">
        Can’t find your league or competition?{" "}
        <Link href="/account/leagues/new" className="font-medium text-zinc-900 underline">
          Add it
        </Link>{" "}
        and then create your team in it.
      </p>
    </div>
  );
}
