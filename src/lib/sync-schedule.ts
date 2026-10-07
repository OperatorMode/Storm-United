// When a league linked to a website is read again. Reading a web page uses the
// AI (and often a browser), so instead of checking every hour we look around
// each game:
//   - a few hours before it starts (catches new times and postponements),
//   - when it's over, 1 hour later (results are often posted late), 12 hours
//     and 48 hours later, stopping as soon as its result is in.
// The ladder follows the after-game steps, stopping once it has changed since
// the game. (Spreadsheet and calendar links are cheap to read and keep their
// own short refresh, see feeds.ts.)

const HOUR = 60 * 60 * 1000;
export const GAME_LENGTH_MS = 2.5 * HOUR; // kick-off to "it's over", with a margin
const CHECKS_AFTER_END_MS = [0, 1 * HOUR, 12 * HOUR, 48 * HOUR];
const CHECK_BEFORE_START_MS = 6 * HOUR;

type Game = { kickoff: string; home_score: number | null; status: string };

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

/** The after-game check times: when it ends, then 1, 12 and 48 hours later. */
function checkTimes(g: Game): number[] {
  const end = time(g.kickoff) + GAME_LENGTH_MS;
  return CHECKS_AFTER_END_MS.map((after) => end + after);
}

/** Whether a check time has come since the last check. */
const dueSince = (times: number[], lastCheck: number, now: number) => times.some((t) => t <= now && lastCheck < t);

export function dueChecks(
  c: { feed_synced_at?: string | null; ladder_url?: string | null; ladder_checked_at?: string | null; ladder_table?: { syncedAt: string } | null },
  games: Game[],
  now = Date.now(),
): { fixtures: boolean; ladder: boolean } {
  const lastSync = time(c.feed_synced_at);
  // Before a game: one look a few hours out, for changed times or postponements.
  const soon = games.filter((g) => g.status === "scheduled" && time(g.kickoff) > now);
  const before = soon.some((g) => dueSince([time(g.kickoff) - CHECK_BEFORE_START_MS], lastSync, now));
  // After a game: until its result is in (postponed or cancelled ones are settled).
  const ended = games.filter((g) => time(g.kickoff) + GAME_LENGTH_MS <= now);
  const waiting = ended.filter((g) => g.home_score === null && g.status === "scheduled");
  const after = waiting.some((g) => dueSince(checkTimes(g), lastSync, now));
  // The ladder: games it hasn't caught up with since they ended.
  const ladderChanged = time(c.ladder_table?.syncedAt);
  const behind = c.ladder_url ? ended.filter((g) => ladderChanged < time(g.kickoff) + GAME_LENGTH_MS) : [];
  const ladder = behind.some((g) => dueSince(checkTimes(g), time(c.ladder_checked_at), now));
  return { fixtures: before || after, ladder };
}
