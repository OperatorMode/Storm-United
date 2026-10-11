"use server";

import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTeam, hashSecret, type Team } from "@/lib/teams";
import { getTeamRow, upsertTeam } from "@/lib/store";
import { ORGANISER, addGuest, createEvent, decideGuest, isEvent, setRsvp } from "@/lib/my-events";
import { ensureDeviceId } from "@/lib/device";
import { recordPhone } from "@/lib/phones";
import { linkManager } from "@/lib/accounts";
import { notifyManagers } from "@/lib/push";
import { parseDate, parseTime, zonedTime } from "@/lib/fixtures";
import { DEFAULT_TZ, isTimezone } from "@/lib/time";
import {
  COOKIE_OPTS,
  adminCookie,
  adminToken,
  canView,
  currentChildren,
  currentManagerId,
  inviteCookie,
  inviteSignature,
  isTeamAdmin,
  pickedChildren,
  voterCookie,
} from "@/lib/session";

// My Event: creating an event, guests joining through an invitation, answers,
// and the organisers' controls.

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function eventFor(id: string): Promise<Team | null> {
  const t = await getTeam(id);
  return t && isEvent(t) ? t : null;
}

/** Who invited this phone (from its invitation link): "org", a guest's id, or null. */
async function invitedBy(eventId: string): Promise<string | null> {
  const raw = (await cookies()).get(inviteCookie(eventId))?.value ?? "";
  const [by, sig] = raw.split(".");
  return by && sig && sig === inviteSignature(eventId, by) ? by : null;
}

/** Creating an event. Organiser access: the email account if signed in, and/or an organiser code. */
export async function createEventAction(_: unknown, form: FormData) {
  const name = clean(form.get("name"), 60);
  const date = parseDate(String(form.get("date") ?? ""));
  const start = parseTime(String(form.get("start") ?? ""));
  const end = String(form.get("end") ?? "") ? parseTime(String(form.get("end"))) : null;
  const tz = isTimezone(String(form.get("tz") ?? "")) ? String(form.get("tz")) : DEFAULT_TZ;
  const code = String(form.get("code") ?? "").trim();
  const managerId = await currentManagerId();
  if (!name) return { error: "Give your event a name." };
  if (!date) return { error: "Pick the date." };
  if (!start) return { error: "Pick the start time." };
  if (String(form.get("end") ?? "") && !end) return { error: "That end time doesn’t look right." };
  if (!managerId && code.length < 4) return { error: "Set an organiser code (at least 4 characters), or sign in with email." };
  if (code && code.length < 4) return { error: "The organiser code needs at least 4 characters." };
  const startsAt = zonedTime(date, start, tz);
  let endsAt = end ? zonedTime(date, end, tz) : null;
  if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000); // goes past midnight
  const rsvpBy = String(form.get("rsvp_by") ?? "") ? parseDate(String(form.get("rsvp_by"))) : null;
  const hex = (v: unknown, d: string) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v) : d);
  const event = await createEvent(
    {
      name,
      host: clean(form.get("host"), 40) || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      place: clean(form.get("place"), 120) || null,
      details: String(form.get("details") ?? "").trim().slice(0, 2000) || null,
      rsvpBy,
      tz,
      primary: hex(form.get("primary"), "#0f766e"),
      accent: hex(form.get("accent"), "#f59e0b"),
    },
    code ? hashSecret(code) : null,
  );
  if (managerId) await linkManager(event.id, managerId);
  // This phone is the organiser's: unlocked and in.
  const store = await cookies();
  const team = (await getTeam(event.id))!;
  if (code) store.set(adminCookie(event.id), adminToken(team)!, COOKIE_OPTS);
  store.set(inviteCookie(event.id), `${ORGANISER}.${inviteSignature(event.id, ORGANISER)}`, COOKIE_OPTS);
  redirect(`/${event.id}/admin?created`);
}

/** A guest family joins through its invitation link. */
export async function joinEvent(eventId: string, familyName: string) {
  const event = await eventFor(eventId);
  if (!event || !(await canView(event))) return { error: "This invitation isn’t open on this phone." };
  const by = (await isTeamAdmin(event)) ? ORGANISER : await invitedBy(event.id);
  if (!by) return { error: "Open the invitation link again to join." };
  const name = clean(familyName, 40);
  if (name.length < 2) return { error: "Type your name or your family’s, e.g. The Parkers." };
  if (event.allPlayers.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `“${name}” is already on the list. If that’s you, pick it below instead.` };
  }
  const guest = await addGuest(event, name, by);
  const store = await cookies();
  store.set(voterCookie(event.id), guest.id, COOKIE_OPTS);
  await recordPhone(event.id, await ensureDeviceId(), [guest.id], false, (await headers()).get("user-agent"));
  if (guest.pending) {
    after(() =>
      notifyManagers(event.id, {
        title: `${event.name}: ${name} would like to come`,
        body: "Someone was invited by a guest. Open Organiser to let them in.",
        url: `/${event.id}/admin`,
        icon: `/${event.id}/icon/192`,
      }),
    );
  }
  revalidatePath(`/${event.id}`, "layout");
  return { ok: true, pending: !!guest.pending };
}

/** Going / Maybe / Can't, and how many adults and kids. */
export async function answerEvent(eventId: string, status: "yes" | "maybe" | "no", adults: number, kids: number) {
  const event = await eventFor(eventId);
  if (!event) return { error: "Event not found." };
  const guest = (await currentChildren(event))[0];
  if (!guest) return { error: "Join the event first." };
  if (!["yes", "maybe", "no"].includes(status)) return { error: "Invalid answer." };
  if (status !== "no" && adults + kids < 1) return { error: "How many are coming?" };
  await setRsvp(event.id, guest, status, status === "no" ? 0 : adults, status === "no" ? 0 : kids);
  revalidatePath(`/${event.id}`, "layout");
  revalidatePath("/me");
  return { ok: true };
}

/** A guest's own invitation link, to pass the event on (an organiser lets those people in). */
export async function myInviteLink(eventId: string) {
  const event = await eventFor(eventId);
  if (!event) return { error: "Event not found." };
  const by = (await isTeamAdmin(event)) ? ORGANISER : (await currentChildren(event))[0];
  if (!by) return { error: "Join the event first." };
  return { path: `/${event.id}/join?by=${encodeURIComponent(by)}&s=${inviteSignature(event.id, by)}`, organiser: by === ORGANISER };
}

/** Organiser: let a waiting family in, or not. */
export async function decideEventGuest(eventId: string, guestId: string, letIn: boolean) {
  const event = await eventFor(eventId);
  if (!event || !(await isTeamAdmin(event))) return { error: "Organisers only." };
  await decideGuest(event, guestId, letIn);
  revalidatePath(`/${event.id}`, "layout");
  return { ok: true };
}

/** Organiser: change the event's details. */
export async function updateEventDetails(eventId: string, _: unknown, form: FormData) {
  const event = await eventFor(eventId);
  if (!event || !(await isTeamAdmin(event))) return { error: "Organisers only." };
  const row = await getTeamRow(event.id);
  if (!row) return { error: "Event not found." };
  const name = clean(form.get("name"), 60);
  const date = parseDate(String(form.get("date") ?? ""));
  const start = parseTime(String(form.get("start") ?? ""));
  const end = String(form.get("end") ?? "") ? parseTime(String(form.get("end"))) : null;
  const tz = isTimezone(String(form.get("tz") ?? "")) ? String(form.get("tz")) : DEFAULT_TZ;
  if (!name || !date || !start) return { error: "Name, date and start time are needed." };
  const startsAt = zonedTime(date, start, tz);
  let endsAt = end ? zonedTime(date, end, tz) : null;
  if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000);
  const code = String(form.get("code") ?? "").trim();
  if (code && code.length < 4) return { error: "The organiser code needs at least 4 characters." };
  await upsertTeam({
    ...row,
    name,
    league_name: name,
    event_host: clean(form.get("host"), 40) || null,
    event_starts_at: startsAt.toISOString(),
    event_ends_at: endsAt?.toISOString() ?? null,
    event_place: clean(form.get("place"), 120) || null,
    event_details: String(form.get("details") ?? "").trim().slice(0, 2000) || null,
    rsvp_by: String(form.get("rsvp_by") ?? "") ? parseDate(String(form.get("rsvp_by"))) : null,
    event_tz: tz,
    admin_pin_hash: code ? hashSecret(code) : row.admin_pin_hash,
  });
  revalidatePath(`/${event.id}`, "layout");
  revalidatePath("/me");
  return { ok: true };
}

/** For a second phone of a family already on the list: pick it (that family lets this phone in). */
export async function pickedGuest(eventId: string): Promise<string | null> {
  const event = await eventFor(eventId);
  return event ? ((await pickedChildren(event))[0] ?? null) : null;
}
