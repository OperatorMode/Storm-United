import Link from "next/link";
import { SidelnrLink } from "@/components/SidelnrLink";
import { TabBar } from "@/components/TabBar";
import { Directions } from "@/components/Directions";
import { GuideLink } from "@/components/Guide";
import { FamilyRequests, type OtherPhone } from "@/components/FamilyPhones";
import { NotificationSettings } from "@/components/NotificationSettings";
import { AnswerEvent, InviteLink, InvitationAnswer } from "./EventClient";
import { getDeviceName } from "@/lib/profile";
import { listRsvps } from "@/lib/my-events";
import { approvedChildren, ids as idList, listPhones } from "@/lib/phones";
import { tabData } from "@/lib/tabs";
import { pushPublicKey } from "@/lib/push";
import { DEFAULT_TZ, formatDay, formatTime, formatIsoDate } from "@/lib/time";
import { canView, currentChildren, currentDeviceId, isTeamAdmin, pickedChildren, voterCookie, waitingChildren } from "@/lib/session";
import { cookies } from "next/headers";
import type { Team } from "@/lib/teams";

// An event's home page: what, when, where, who's coming, and your answer.
// Guests see each other's answers; organisers also see who hasn't answered yet.
export async function EventHome({ event, joined = false }: { event: Team; joined?: boolean }) {
  const tz = event.event_tz ?? DEFAULT_TZ;
  const start = event.event_starts_at ? new Date(event.event_starts_at) : null;
  const end = event.event_ends_at ? new Date(event.event_ends_at) : null;
  const header = (
    <header className="jersey px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <SidelnrLink />
      <div className="mt-1 text-xs uppercase tracking-widest text-on-team/60">Event</div>
      <h1 className="mt-0.5 text-2xl font-semibold">{event.name}</h1>
      {event.event_host && <p className="text-sm text-on-team/70">Hosted by {event.event_host}</p>}
      {start && (
        <p className="mt-2 text-sm font-medium">
          {formatDay(start, tz)}, {formatTime(start, tz)}
          {end ? ` to ${formatTime(end, tz)}` : ""}
        </p>
      )}
    </header>
  );

  if (!(await canView(event))) {
    return (
      <div className="mx-auto max-w-md pb-10">
        {header}
        <main className="mt-4 px-4">
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            This event is invitation only. Open the invitation link you were sent, or ask the organiser for one.
          </p>
        </main>
      </div>
    );
  }

  const [children, picked, waiting, rsvps, admin, tabs, deviceId] = await Promise.all([
    currentChildren(event),
    pickedChildren(event),
    waitingChildren(event),
    listRsvps(event.id),
    isTeamAdmin(event),
    tabData(event),
    currentDeviceId(),
  ]);
  const guestId = children[0] ?? null;
  const me = guestId ? event.allPlayers.find((p) => p.id === guestId) : null;
  // A family still waiting for an organiser isn't "picked" yet (it isn't on the list): read this phone's own choice.
  const chosen = (await cookies()).get(voterCookie(event.id))?.value ?? picked[0] ?? null;
  const pickedGuest = chosen ? event.allPlayers.find((p) => p.id === chosen) : null;
  const awaitingOrganiser = !!pickedGuest?.pending;
  const answerOf = (id: string) => rsvps.find((r) => r.guest_id === id) ?? null;
  const guests = event.players; // let in (not waiting)
  const groups = {
    yes: guests.filter((g) => answerOf(g.id)?.status === "yes"),
    maybe: guests.filter((g) => answerOf(g.id)?.status === "maybe"),
    no: guests.filter((g) => answerOf(g.id)?.status === "no"),
    none: guests.filter((g) => !answerOf(g.id)),
  };
  const heads = (list: { id: string }[]) =>
    list.reduce((a, g) => ({ adults: a.adults + (answerOf(g.id)?.adults ?? 0), kids: a.kids + (answerOf(g.id)?.kids ?? 0) }), { adults: 0, kids: 0 });
  const going = heads(groups.yes);
  const people = (n: { adults: number; kids: number }) =>
    [n.adults && `${n.adults} adult${n.adults === 1 ? "" : "s"}`, n.kids && `${n.kids} kid${n.kids === 1 ? "" : "s"}`].filter(Boolean).join(", ");

  // A second phone of a family on the list: that family lets it in (family approval).
  const requests: OtherPhone[] = [];
  if (guestId) {
    for (const ph of await listPhones(event.id)) {
      if (ph.device_id === deviceId || !ph.member_id || !idList(ph.children).includes(guestId) || approvedChildren(ph).includes(guestId)) continue;
      requests.push({ memberId: ph.member_id, childId: guestId, childName: me?.name ?? "", label: "Another phone", device: ph.device ?? "Phone", when: formatDay(new Date(ph.last_seen), tz) });
    }
  }

  return (
    <div className="mx-auto max-w-md pb-24">
      {header}
      <main className="-mt-2 space-y-4 px-4">
        <section className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
          {event.event_place && (
            <div className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-xs uppercase tracking-wide text-zinc-500">Where</span>
                <span className="font-medium">{event.event_place}</span>
              </span>
              <Directions place={event.event_place} className="shrink-0 bg-zinc-900 text-white" />
            </div>
          )}
          {event.event_details && (
            <div className="border-t border-zinc-100 pt-2">
              <span className="block text-xs uppercase tracking-wide text-zinc-500">Details</span>
              <p className="whitespace-pre-wrap text-zinc-700">{event.event_details}</p>
            </div>
          )}
          {(me || admin) && (
            <a href={`/${event.id}/event.ics`} className="block border-t border-zinc-100 pt-2 font-medium underline">
              Add to my phone’s calendar
            </a>
          )}
        </section>

        {joined && me && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">You’re in, {me.name}!</div>
            <p className="mt-1">
              This event is now on your{" "}
              <Link href="/" className="font-medium underline">
                home page
              </Link>{" "}
              and in{" "}
              <Link href="/me" className="font-medium underline">
                My Activities
              </Link>
              . Change your answer below any time. Updates from the organisers are under News, and you can talk to everyone in Chat.
            </p>
          </div>
        )}

        <FamilyRequests teamId={event.id} requests={requests} />

        {me ? (
          <AnswerEvent
            eventId={event.id}
            name={me.name}
            current={answerOf(me.id) ? { status: answerOf(me.id)!.status, adults: answerOf(me.id)!.adults, kids: answerOf(me.id)!.kids } : null}
            rsvpBy={event.rsvp_by ? formatIsoDate(event.rsvp_by, tz) : null}
          />
        ) : awaitingOrganiser ? (
          <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <b>Thanks, {pickedGuest!.name}.</b> You were invited by another guest, so an organiser needs to let you in. You’ll see the
            event and can answer once they have.
          </p>
        ) : pickedGuest && !pickedGuest.active ? (
          <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            The organiser didn’t add {pickedGuest.name} to this event. If you think that’s a mistake, ask them.
          </p>
        ) : waiting.length ? (
          <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Waiting for your family to let this phone in. They’ve been sent a message.
          </p>
        ) : (
          <InvitationAnswer
            eventId={event.id}
            needName={!(await getDeviceName(deviceId))}
            rsvpBy={event.rsvp_by ? formatIsoDate(event.rsvp_by, tz) : null}
            families={guests.map((g) => ({ id: g.id, name: g.name }))}
          />
        )}

        {(me || admin) && (
          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Who’s coming</h2>
              <span className="text-xs text-zinc-500">{people(going) || "No one yet"}</span>
            </div>
            {(
              [
                ["yes", "Going"],
                ["maybe", "Maybe"],
                ["no", "Can’t come"],
                ...(admin ? ([["none", "No answer yet"]] as const) : []),
              ] as const
            ).map(([k, title]) =>
              groups[k].length ? (
                <div key={k}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {title} ({groups[k].length})
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {groups[k].map((g) => {
                      const a = answerOf(g.id);
                      return (
                        <li key={g.id} className="flex justify-between gap-2">
                          <span>{g.name}</span>
                          {a && a.status !== "no" && <span className="text-xs text-zinc-500">{people(a)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null,
            )}
            {!admin && groups.none.length > 0 && <p className="text-xs text-zinc-500">{groups.none.length} more invited, no answer yet.</p>}
          </section>
        )}

        {me && (
          <div className="space-y-1">
            <InviteLink eventId={event.id} eventName={event.name} />
            <p className="text-center text-xs text-zinc-500">Anyone you invite needs an organiser’s OK.</p>
          </div>
        )}
        {me && <NotificationSettings teamId={event.id} vapidKey={pushPublicKey()} />}

        <p className="pt-2 text-center text-xs text-zinc-500">
          {admin ? (
            <Link href={`/${event.id}/admin`} className="underline">
              Organiser
            </Link>
          ) : (
            <GuideLink />
          )}
        </p>
      </main>
      <TabBar teamId={event.id} active="home" {...tabs} />
    </div>
  );
}
