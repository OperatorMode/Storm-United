import { check, db, readLocal, writeLocal } from "./store";

// Merges one player into another within a team — used when a name was retyped
// in Team settings (which creates a new player and hides the old one). Moves
// attendance/goalie, ballots (cast and received), board acknowledgements, chat
// and notification ownership from `fromId` to `toId`, then deletes `fromId`.
// Where both have an answer for the same game/post, `toId`'s answer is kept.
export async function mergePlayer(teamId: string, fromId: string, toId: string): Promise<void> {
  const s = db();
  if (!s) return mergeLocal(teamId, fromId, toId);

  // Attendance: keep the new player's answer where both answered.
  const toGames = (check(
    await s.from("attendance").select("game_id").eq("team_id", teamId).eq("player_id", toId),
  ) as { game_id: string }[]).map((r) => r.game_id);
  if (toGames.length) {
    check(await s.from("attendance").delete().eq("team_id", teamId).eq("player_id", fromId).in("game_id", toGames));
  }
  check(await s.from("attendance").update({ player_id: toId }).eq("team_id", teamId).eq("player_id", fromId));

  // Ballots cast by this family.
  const toBallots = (check(
    await s.from("ballots").select("game_id").eq("team_id", teamId).eq("voter_id", toId),
  ) as { game_id: string }[]).map((r) => r.game_id);
  if (toBallots.length) {
    check(await s.from("ballots").delete().eq("team_id", teamId).eq("voter_id", fromId).in("game_id", toBallots));
  }
  check(await s.from("ballots").update({ voter_id: toId }).eq("team_id", teamId).eq("voter_id", fromId));

  // Votes received. A ballot naming both would become invalid (same player
  // twice) — those are dropped rather than broken.
  const both = (check(
    await s.from("ballots").select("game_id, voter_id, first, second, third").eq("team_id", teamId),
  ) as { game_id: string; voter_id: string; first: string; second: string; third: string }[]).filter((b) => {
    const picks = [b.first, b.second, b.third];
    return picks.includes(fromId) && picks.includes(toId);
  });
  for (const b of both) {
    check(await s.from("ballots").delete().eq("team_id", teamId).eq("game_id", b.game_id).eq("voter_id", b.voter_id));
  }
  for (const col of ["first", "second", "third"] as const) {
    check(await s.from("ballots").update({ [col]: toId }).eq("team_id", teamId).eq(col, fromId));
  }

  // Board acknowledgements (acks have no team column — go via the team's posts).
  const posts = (check(await s.from("announcements").select("id").eq("team_id", teamId)) as { id: string }[]).map((r) => r.id);
  if (posts.length) {
    const toAcked = (check(
      await s.from("announcement_acks").select("announcement_id").eq("player_id", toId).in("announcement_id", posts),
    ) as { announcement_id: string }[]).map((r) => r.announcement_id);
    if (toAcked.length) {
      check(await s.from("announcement_acks").delete().eq("player_id", fromId).in("announcement_id", toAcked));
    }
    check(await s.from("announcement_acks").update({ player_id: toId }).eq("player_id", fromId).in("announcement_id", posts));
  }

  check(await s.from("chat_messages").update({ author_id: toId }).eq("team_id", teamId).eq("author_id", fromId));
  check(await s.from("push_subscriptions").update({ author_id: toId }).eq("team_id", teamId).eq("author_id", fromId));
  check(await s.from("players").delete().eq("team_id", teamId).eq("id", fromId));
}

async function mergeLocal(teamId: string, fromId: string, toId: string) {
  const d = await readLocal();
  const mine = <T extends { team_id: string }>(r: T) => r.team_id === teamId;

  const toGames = new Set(d.attendance.filter((a) => mine(a) && a.player_id === toId).map((a) => a.game_id));
  d.attendance = d.attendance
    .filter((a) => !(mine(a) && a.player_id === fromId && toGames.has(a.game_id)))
    .map((a) => (mine(a) && a.player_id === fromId ? { ...a, player_id: toId } : a));

  const toBallots = new Set(d.ballots.filter((b) => mine(b) && b.voter_id === toId).map((b) => b.game_id));
  d.ballots = d.ballots
    .filter((b) => !(mine(b) && b.voter_id === fromId && toBallots.has(b.game_id)))
    .filter((b) => !(mine(b) && [b.first, b.second, b.third].includes(fromId) && [b.first, b.second, b.third].includes(toId)))
    .map((b) => {
      if (!mine(b)) return b;
      const sw = (id: string) => (id === fromId ? toId : id);
      return { ...b, voter_id: sw(b.voter_id), first: sw(b.first), second: sw(b.second), third: sw(b.third) };
    });

  const posts = new Set((d.announcements ?? []).filter(mine).map((a) => a.id));
  const toAcked = new Set((d.acks ?? []).filter((k) => posts.has(k.announcement_id) && k.player_id === toId).map((k) => k.announcement_id));
  d.acks = (d.acks ?? [])
    .filter((k) => !(posts.has(k.announcement_id) && k.player_id === fromId && toAcked.has(k.announcement_id)))
    .map((k) => (posts.has(k.announcement_id) && k.player_id === fromId ? { ...k, player_id: toId } : k));

  d.chat = (d.chat ?? []).map((m) => (mine(m) && m.author_id === fromId ? { ...m, author_id: toId } : m));
  d.subs = (d.subs ?? []).map((x) => (mine(x) && x.author_id === fromId ? { ...x, author_id: toId } : x));
  d.players = d.players.filter((p) => !(mine(p) && p.id === fromId));
  await writeLocal(d);
}
