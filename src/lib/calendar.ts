import { createHmac, timingSafeEqual } from "crypto";
import { gamePlace, getLeagueData, meetingTime, opponent, pitchLabel } from "./league";
import { canView, currentChildren, joinToken } from "./session";
import { firstName, getTeam, playerName, type Team } from "./teams";
import { listTraining } from "./training";
import { listDutySignups } from "./duties";

// Calendar subscriptions (webcal / .ics). A phone gets a signed link listing
// its teams (and children); calendar apps fetch it without cookies, so the
// signature is what proves the link was handed out by Sidelnr. For teams with
// a join code the link also carries a fingerprint of that code: changing the
// code switches old calendar links off.

type Entry = { t: string; c: string[]; j?: string }; // team, children, join-code fingerprint

const secret = () =>
  process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ADMIN_PIN ?? "local-dev";
const sign = (payload: string) => createHmac("sha256", `calendar:${secret()}`).update(payload).digest("base64url").slice(0, 32);
const fingerprint = (team: Team) => joinToken(team)?.slice(0, 12);

/** A calendar token for these teams, for the phone making the request. */
export async function calendarToken(teams: Team[]): Promise<string | null> {
  const entries: Entry[] = [];
  for (const team of teams) {
    if (!(await canView(team))) continue;
    const j = fingerprint(team);
    entries.push({ t: team.id, c: await currentChildren(team), ...(j ? { j } : {}) });
  }
  if (!entries.length) return null;
  const payload = Buffer.from(JSON.stringify(entries)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): Entry[] | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const entries = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Entry[];
    return Array.isArray(entries) ? entries.slice(0, 20) : null;
  } catch {
    return null;
  }
}

// ---------- .ics ----------

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Lines longer than 75 bytes are folded (continuation lines start with a space).
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

const PAST_DAYS = 21 * 24 * 60 * 60 * 1000; // keep the last three weeks of games too
const GAME_MINUTES = 60;

/** The calendar for a token, or null if the link isn't valid (any more). */
export async function calendarFor(token: string, origin: string): Promise<string | null> {
  const entries = readToken(token);
  if (!entries) return null;
  const events: string[] = [];
  const teamNames: string[] = [];
  const now = Date.now();

  for (const entry of entries) {
    const team = await getTeam(entry.t);
    if (!team) continue;
    if (fingerprint(team) && fingerprint(team) !== entry.j) continue; // join code changed
    teamNames.push(team.name);
    const kids = entry.c.filter((id) => team.players.some((p) => p.id === id)).map((id) => firstName(playerName(team, id)));
    const { competition, tz, ourGames } = await getLeagueData(team);
    const duties = await listDutySignups(team.id);
    const dutiesFor = (gameId: string) => duties.filter((d) => d.game_id === gameId && entry.c.includes(d.player_id)).map((d) => d.duty);
    for (const t of await listTraining(team.id)) {
      const start = new Date(t.starts_at);
      if (start.getTime() < now - PAST_DAYS) continue;
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${team.id}-${t.id}@sidelnr.app`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART:${stamp(start)}`,
          `DTEND:${stamp(new Date(start.getTime() + t.minutes * 60_000))}`,
          `SUMMARY:${esc(`${t.cancelled ? "CANCELLED: " : ""}${team.name} training`)}`,
          t.location ? `LOCATION:${esc(t.location)}` : null,
          `DESCRIPTION:${esc([kids.length ? `${kids.join(" & ")} · ${team.name}` : team.name, t.note, `${origin}/${team.id}`].filter(Boolean).join("\n"))}`,
          t.cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
          "END:VEVENT",
        ]
          .filter((l): l is string => l !== null)
          .map(fold)
          .join("\r\n"),
      );
    }
    for (const g of ourGames) {
      if (g.kickoff.getTime() < now - PAST_DAYS) continue;
      const us = team.league_name;
      const vs = `${g.home === us ? "vs" : "@"} ${opponent(g, us)}`;
      const postponed = g.time === "Postponed";
      const place = [gamePlace(g.pitch, competition), g.pitch && pitchLabel(g.pitch) !== gamePlace(g.pitch, competition) ? pitchLabel(g.pitch) : null]
        .filter(Boolean)
        .join(", ");
      const details = [
        kids.length ? `${kids.join(" & ")} · ${team.name}` : team.name,
        team.meet_minutes > 0 && !postponed ? `Meet ${meetingTime(g, team.meet_minutes, tz)}` : null,
        dutiesFor(g.id).length ? `You’re on: ${dutiesFor(g.id).join(", ")}` : null,
        `${origin}/${team.id}`,
      ].filter(Boolean);
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${team.id}-${g.id}@sidelnr.app`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART:${stamp(g.kickoff)}`,
          `DTEND:${stamp(new Date(g.kickoff.getTime() + GAME_MINUTES * 60_000))}`,
          `SUMMARY:${esc(`${postponed ? "POSTPONED: " : ""}${team.name} ${vs}`)}`,
          place ? `LOCATION:${esc(place)}` : null,
          `DESCRIPTION:${esc(details.join("\n"))}`,
          `URL:${origin}/${team.id}`,
          postponed ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
          "END:VEVENT",
        ]
          .filter((l): l is string => l !== null)
          .map(fold)
          .join("\r\n"),
      );
    }
  }
  if (!teamNames.length) return null;

  const name = teamNames.length === 1 ? `${teamNames[0]} (Sidelnr)` : "My Player (Sidelnr)";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sidelnr//Games//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${esc(name)}`),
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
