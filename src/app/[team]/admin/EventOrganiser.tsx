import Link from "next/link";
import { SidelnrLink } from "@/components/SidelnrLink";
import { TabBar } from "@/components/TabBar";
import { Card } from "@/components/Card";
import { AdminLogin } from "./AdminLogin";
import { AddToMyTeams } from "./AccountLink";
import { EventDetailsForm, GuestDecision } from "./EventOrganiserClient";
import { InviteLink } from "../EventClient";
import { listRsvps, pendingGuests } from "@/lib/my-events";
import { tabData } from "@/lib/tabs";
import { emailEnabled } from "@/lib/email";
import { teamManagerIds } from "@/lib/accounts";
import { DEFAULT_TZ, isoDateIn } from "@/lib/time";
import { adminAccess, currentManagerId } from "@/lib/session";
import type { Team } from "@/lib/teams";
import { adminLogout } from "./actions";

// The Organiser tab of an event: invite people, let in families a guest
// invited, see every answer (and who hasn't answered), and change the details.
export async function EventOrganiser({ event, created }: { event: Team; created: boolean }) {
  const tz = event.event_tz ?? DEFAULT_TZ;
  const tabs = await tabData(event);
  const header = (
    <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <SidelnrLink />
      <div className="text-xs uppercase tracking-widest text-on-team/50">{event.name}</div>
      <h1 className="mt-1 text-2xl font-semibold">Organiser</h1>
    </header>
  );
  const emailBenefits = (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-500">
      <li>Your event is safe if you lose or change your phone</li>
      <li>Open it on any phone or computer</li>
      <li>All your events and teams in one place, under My Event</li>
    </ul>
  );

  const access = await adminAccess(event);
  if (!access) {
    return (
      <div className="mx-auto max-w-md pb-24">
        {header}
        <main className="mt-4 space-y-4 px-4">
          <Card title="Organisers only">
            <p className="mb-3 text-sm text-zinc-500">Enter the organiser code to manage this event.</p>
            <AdminLogin teamId={event.id} />
            {emailEnabled() && (
              <div className="mt-4 border-t border-zinc-100 pt-4 text-sm">
                <Link href={`/login?next=/${event.id}/admin`} className="font-medium underline">
                  Sign in with email
                </Link>
                <span className="text-zinc-500"> if you’re already an organiser with an account.</span>
              </div>
            )}
          </Card>
        </main>
        <TabBar teamId={event.id} active="manager" {...tabs} />
      </div>
    );
  }

  const [rsvps, managerId, managers] = await Promise.all([listRsvps(event.id), currentManagerId(), teamManagerIds(event.id)]);
  const linked = !!managerId && managers.includes(managerId);
  const waiting = pendingGuests(event);
  const answerOf = (id: string) => rsvps.find((r) => r.guest_id === id);
  const total = event.players.reduce(
    (a, g) => {
      const r = answerOf(g.id);
      if (r?.status === "yes") return { ...a, adults: a.adults + r.adults, kids: a.kids + r.kids };
      return a;
    },
    { adults: 0, kids: 0 },
  );
  const start = event.event_starts_at ? new Date(event.event_starts_at) : null;
  const end = event.event_ends_at ? new Date(event.event_ends_at) : null;
  const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz, hour12: false });

  return (
    <div className="mx-auto max-w-md pb-24">
      {header}
      <main className="mt-4 space-y-4 px-4">
        {created && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">{event.name} is ready</div>
            <p className="mt-1">
              Now invite your guests: share the invitation link in a message or your group chat. You’ll find the event on your
              home page under My Event, and in My Activities.
            </p>
          </div>
        )}

        <Card title="Invite guests">
          <p className="mb-3 text-sm text-zinc-500">
            People with your link are in straight away. Guests can pass the invitation on too: anyone they invite waits for an
            organiser’s OK, here.
          </p>
          <InviteLink eventId={event.id} eventName={event.name} label="Share the invitation" />
        </Card>

        {waiting.length > 0 && (
          <Card title="Waiting for your OK" aside={`${waiting.length}`}>
            <ul className="space-y-2 text-sm">
              {waiting.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{g.name}</span>
                    {g.invited_by && g.invited_by !== "org" && (
                      <span className="block text-xs text-zinc-500">
                        Invited by {event.allPlayers.find((p) => p.id === g.invited_by)?.name ?? "a guest"}
                      </span>
                    )}
                  </span>
                  <GuestDecision eventId={event.id} guestId={g.id} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Answers" aside={`${total.adults} adults · ${total.kids} kids going`}>
          <ul className="divide-y divide-zinc-100 text-sm">
            {event.players.map((g) => {
              const r = answerOf(g.id);
              return (
                <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span>{g.name}</span>
                  <span className={`text-xs ${!r ? "text-amber-700" : "text-zinc-500"}`}>
                    {!r ? "No answer yet" : r.status === "no" ? "Can’t come" : `${r.status === "yes" ? "Going" : "Maybe"} · ${r.adults} + ${r.kids} kids`}
                  </span>
                </li>
              );
            })}
            {!event.players.length && <li className="py-2 text-zinc-500">No guests yet. Share the invitation above.</li>}
          </ul>
        </Card>

        <Card title="Event details">
          <EventDetailsForm
            eventId={event.id}
            initial={{
              type: event.event_type ?? "other",
              dress: event.event_dress ?? "",
              name: event.name,
              host: event.event_host ?? "",
              date: start ? isoDateIn(start, tz) : "",
              start: start ? hhmm(start) : "",
              end: end ? hhmm(end) : "",
              place: event.event_place ?? "",
              details: event.event_details ?? "",
              rsvpBy: event.rsvp_by ?? "",
            }}
          />
        </Card>

        <Card title="Organisers">
          <div className="space-y-3 text-sm text-zinc-600">
            <p>
              <b className="text-zinc-900">Another organiser?</b> Give them the organiser code: they open the event, tap Organiser and
              enter it. You can change the code under Event details.
            </p>
            {linked ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">This event is saved to your account.</p>
            ) : managerId ? (
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Save this event to your account</span>
                  <AddToMyTeams teamId={event.id} teamName="Save" />
                </div>
                {emailBenefits}
              </div>
            ) : (
              emailEnabled() && (
                <div className="rounded-xl bg-zinc-50 px-3 py-2">
                  <Link href={`/login?next=/${event.id}/admin`} className="font-medium text-zinc-900 underline">
                    Sign in with email
                  </Link>{" "}
                  (no password, just a link). Recommended:
                  {emailBenefits}
                </div>
              )
            )}
          </div>
        </Card>

        <form action={adminLogout.bind(null, event.id)} className="text-center">
          <button className="text-sm text-zinc-500 underline">Lock / sign out</button>
        </form>
      </main>
      <TabBar teamId={event.id} active="manager" {...tabs} />
    </div>
  );
}
