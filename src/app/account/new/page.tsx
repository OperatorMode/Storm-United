import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupTeam } from "../SetupTeam";
import { createMyTeam } from "../team-actions";
import { currentManagerId } from "@/lib/session";
import { competitionLabel, getCompetition } from "@/lib/league";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Set up your team · Sidelnr", robots: { index: false } };

// Reading a league's website (and finding the squad on it) can take a minute or two.
export const maxDuration = 300;

// "Set up your team": one question at a time (see SetupTeam).
export default async function NewTeamPage({ searchParams }: PageProps<"/account/new">) {
  if (!(await currentManagerId())) redirect("/login?next=/account/new");
  // A league set up by hand (or picked elsewhere) starts at the team step in it.
  const picked = (await searchParams).competition;
  const competition = typeof picked === "string" ? await getCompetition(picked) : null;
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="" />
        <Link href="/account">← My teams</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Set up your team</h1>
        <p className="mt-1 text-sm text-zinc-500">A few quick questions to find your games. Fixtures, results and the ladder then load by themselves.</p>
      </div>
      <SetupTeam save={createMyTeam} start={competition ? { competitionId: competition.id, label: competitionLabel(competition) } : null} />
    </div>
  );
}
