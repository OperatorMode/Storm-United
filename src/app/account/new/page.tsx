import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamForm } from "@/components/TeamForm";
import { createMyTeam } from "../team-actions";
import { currentManagerId } from "@/lib/session";
import { teamFormData } from "@/lib/team-form-data";

export const metadata: Metadata = { title: "Create a team · Sidelnr", robots: { index: false } };

export default async function NewTeamPage() {
  if (!(await currentManagerId())) redirect("/login?next=/account/new");
  const { competitions, taken } = await teamFormData(null);
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <Link href="/account" className="text-sm text-zinc-500">
        ← My teams
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Create a team</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick your competition and your team in its draw — fixtures, results and the ladder then load automatically.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <TeamForm competitions={competitions} taken={taken} initial={null} save={createMyTeam} />
      </section>
      <p className="text-center text-xs text-zinc-400">
        Can’t find your league? Adding your own league and fixtures is coming soon.
      </p>
    </div>
  );
}
