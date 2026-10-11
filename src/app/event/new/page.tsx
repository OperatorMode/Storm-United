import type { Metadata } from "next";
import { SidelnrLink } from "@/components/SidelnrLink";
import { currentManager } from "@/lib/session";
import { emailEnabled } from "@/lib/email";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Create an event · Sidelnr", robots: { index: false } };

// My Event: create a party, a team breakup, a gala day… and invite people to say if they're coming.
export default async function NewEventPage() {
  const manager = await currentManager();
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <SidelnrLink className="" />
      <div>
        <h1 className="text-xl font-semibold">Create an event</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A party, a team breakup, a gala day: invite people with a link, see who’s coming and how many, and keep everyone up
          to date with announcements and a chat.
        </p>
      </div>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <CreateEventForm signedInAs={manager?.email ?? null} emailSignIn={emailEnabled()} />
      </section>
    </div>
  );
}
