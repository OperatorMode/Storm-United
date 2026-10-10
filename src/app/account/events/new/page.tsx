import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewLeagueForm } from "../../leagues/LeagueForms";
import { currentManagerId } from "@/lib/session";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "Create an event · Sidelnr", robots: { index: false } };

export default async function NewEventPage() {
  if (!(await currentManagerId())) redirect("/login?next=/account/events/new");
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
        <SidelnrLink className="text-zinc-900" />
        <Link href="/account/events">← My events</Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Create an event</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A carnival, gala day or cup. Add a division per age group, type the pools and Sidelnr builds the draw across your
          pitches. Enter results as games finish and the public page and every Sidelnr team in it update live.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <NewLeagueForm event />
      </section>
    </div>
  );
}
