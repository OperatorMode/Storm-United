import { getLeagueData, opponent } from "./league";
import { markSent } from "./messages";
import { notifyManagers } from "./push";
import { getManager, teamManagerIds } from "./accounts";
import { seasonEndEmail, sendEmail } from "./email";
import { formatDay } from "./time";
import type { Team } from "./teams";

// A week before a team's last game of the season, its managers are told (a
// notification and an email) so they can get next season ready in time: the
// competition, who's playing again, and what to take (Manager's Corner).

const DAY = 24 * 60 * 60 * 1000;
export const SEASON_END_NOTICE_DAYS = 7;

/** The last game, if it's within the next week. */
export async function seasonEndingSoon(team: Team, now = new Date()) {
  const { tz, ourGames } = await getLeagueData(team);
  const last = ourGames.at(-1);
  if (!last) return null;
  const until = last.kickoff.getTime() - now.getTime();
  if (until <= 0 || until > SEASON_END_NOTICE_DAYS * DAY) return null;
  return { game: last, when: formatDay(last.kickoff, tz), vs: `${last.home === team.league_name ? "vs" : "@"} ${opponent(last, team.league_name)}` };
}

/** Sends the reminder once per season (per last game). Returns true if it went out. */
export async function sendSeasonEndReminder(team: Team, now = new Date()): Promise<boolean> {
  const soon = await seasonEndingSoon(team, now);
  if (!soon || !(await markSent(team.id, `season-end:${soon.game.id}`))) return false;
  const url = `/${team.id}/admin`;
  await notifyManagers(team.id, {
    title: `${team.name}: last game ${soon.when}`,
    body: "The season ends soon. Get next season ready in Manager’s Corner.",
    url,
    icon: `/${team.id}/icon/192`,
  });
  const mail = seasonEndEmail(team.name, `${soon.when} ${soon.vs}`, `https://sidelnr.app${url}`);
  for (const id of await teamManagerIds(team.id)) {
    const m = await getManager(id);
    if (m) await sendEmail(m.email, mail.subject, mail.text, mail.html);
  }
  return true;
}
