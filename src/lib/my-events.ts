import { randomBytes } from "crypto";
import { check, db, getPlayers, readLocal, savePlayers, upsertTeam, writeLocal, type PlayerRow, type TeamRow } from "./store";
import { hashSecret, slugify, type Team } from "./teams";

// My Event: a one-day event set up like a small team. The organisers are its
// managers (an email account or the organiser code, like a team PIN); each
// invited family is a guest (a player row) that answers Going / Maybe / Can't
// with how many adults and kids. A family invited by another guest waits
// (pending) until an organiser lets them in.

export type Rsvp = { team_id: string; guest_id: string; status: "yes" | "maybe" | "no"; adults: number; kids: number; updated_at: string };

export const isEvent = (team: Pick<TeamRow, "kind">) => team.kind === "event";
export const ORGANISER = "org";

export type EventInput = {
  name: string;
  host: string | null;
  startsAt: string; // ISO
  endsAt: string | null;
  place: string | null;
  details: string | null;
  rsvpBy: string | null; // yyyy-mm-dd
  tz: string;
  type: "party" | "birthday" | "dinner" | "other";
  dress: string | null;
  primary: string;
  accent: string;
};

/** A new event (its id is the link: sidelnr.app/<id>). Only invitation links open it. */
export async function createEvent(input: EventInput, organiserPinHash: string | null): Promise<TeamRow> {
  const base = slugify(input.name).slice(0, 40) || "event";
  const id = `${base}-${randomBytes(3).toString("hex")}`;
  const row: TeamRow = {
    id,
    name: input.name,
    league_name: input.name,
    division: "event",
    competition_id: null,
    primary_color: input.primary,
    accent_color: input.accent,
    logo_url: null,
    admin_pin_hash: organiserPinHash,
    // A secret nobody types: the page opens only through an invitation link (it sets the join cookie).
    join_code_hash: hashSecret(randomBytes(16).toString("hex")),
    join_code_key: null,
    meet_minutes: 0,
    goalie_enabled: false,
    kind: "event",
    event_starts_at: input.startsAt,
    event_ends_at: input.endsAt,
    event_place: input.place,
    event_details: input.details,
    event_host: input.host,
    rsvp_by: input.rsvpBy,
    event_tz: input.tz,
    event_type: input.type,
    event_dress: input.dress,
  };
  await upsertTeam(row);
  return row;
}

/** Adds a guest family. Invited by an organiser: in. Invited by another guest: waits for an organiser. */
export async function addGuest(event: Team, name: string, invitedBy: string): Promise<PlayerRow> {
  const all = await getPlayers(event.id);
  const base = slugify(name).slice(0, 24) || "guest";
  let id = base;
  for (let n = 2; all.some((p) => p.id === id); n++) id = `${base}-${n}`;
  const pending = invitedBy !== ORGANISER;
  const row: PlayerRow = { id, name, sort: all.length, active: !pending, pending, invited_by: invitedBy };
  await savePlayers(event.id, [...all, row]);
  return row;
}

/** An organiser lets a waiting guest in (or says no: they're taken off). */
export async function decideGuest(event: Team, guestId: string, letIn: boolean): Promise<void> {
  const all = await getPlayers(event.id);
  const g = all.find((p) => p.id === guestId);
  if (!g) return;
  if (letIn) return savePlayers(event.id, all.map((p) => (p.id === guestId ? { ...p, active: true, pending: false } : p)));
  await savePlayers(event.id, all.map((p) => (p.id === guestId ? { ...p, active: false, pending: false } : p)));
}

/** Families still waiting for an organiser's OK. */
export const pendingGuests = (event: Team) => event.allPlayers.filter((p) => p.pending);

export async function listRsvps(eventId: string): Promise<Rsvp[]> {
  try {
    const s = db();
    if (!s) return ((await readLocal()).event_rsvps ?? []).filter((r) => r.team_id === eventId);
    return check(await s.from("event_rsvps").select("*").eq("team_id", eventId)) as Rsvp[];
  } catch {
    return []; // before migration 032
  }
}

export async function setRsvp(eventId: string, guestId: string, status: Rsvp["status"], adults: number, kids: number): Promise<void> {
  const row: Rsvp = {
    team_id: eventId,
    guest_id: guestId,
    status,
    adults: Math.max(0, Math.min(50, Math.round(adults))),
    kids: Math.max(0, Math.min(50, Math.round(kids))),
    updated_at: new Date().toISOString(),
  };
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.event_rsvps = [...(d.event_rsvps ?? []).filter((r) => !(r.team_id === eventId && r.guest_id === guestId)), row];
    return writeLocal(d);
  }
  check(await s.from("event_rsvps").upsert(row, { onConflict: "team_id,guest_id" }));
}
