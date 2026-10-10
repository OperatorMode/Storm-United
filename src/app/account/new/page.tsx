import type { Metadata } from "next";
import Link from "next/link";
import { AddLeagueCallout } from "@/components/AddLeagueCallout";
import { redirect } from "next/navigation";
import { TeamForm } from "@/components/TeamForm";
import { createMyTeam } from "../team-actions";
import { currentManagerId } from "@/lib/session";
import { competitionLabel, getCompetition } from "@/lib/league";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Create a team · Sidelnr", robots: { index: false } };

// Finding the squad on the league's website can take a minute or two.
export const maxDuration = 300;

export default async function NewTeamPage({ searchParams }: PageProps<"/account/new">) {
  if (!(await currentManagerId())) redirect("/login?next=/account/new");
  // "Create My Team" straight after importing a league starts in that competition.
  const picked = (await searchParams).competition;
  const competition = typeof picked === "string" ? await getCompetition(picked) : null;
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="text-zinc-900" />
        <Link href="/account">← My teams</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Create a team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick your competition and your team in its draw. Fixtures, results and the ladder then load automatically.
        </p>
      </div>
      <AddLeagueCallout />
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <TeamForm
          competitionLabel={competition ? competitionLabel(competition) : null}
          startCompetitionId={competition?.id}
          initial={null}
          save={createMyTeam}
        />
      </section>
      <p className="text-center text-sm text-zinc-500">
        Can’t find your league or competition?{" "}
        <Link href="/account/leagues/new" className="font-medium text-zinc-900 underline">
          Add it with a link
        </Link>{" "}
        and then create your team in it.
      </p>
    </div>
  );
}
