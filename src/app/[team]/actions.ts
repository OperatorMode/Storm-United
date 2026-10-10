"use server";

import { after } from "next/server";
import { redirect, RedirectType } from "next/navigation";
import { gameParts, isSlot, slotFrom, slotParts } from "@/lib/role";
import { deletePushSub } from "@/lib/messages";
import { listTraining } from "@/lib/training";
import { listDuties, listDutySignups, releaseDuty, takeDuty } from "@/lib/duties";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLeagueData, votingState } from "@/lib/league";
import { getTeam, isActivePlayer, verifySecret, type Team } from "@/lib/teams";
import { now } from "@/lib/clock";
import { getAttendance, setAttendance, upsertBallot, type AttendanceStatus, type GoalieHalf } from "@/lib/store";
import { lockedMessage, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { notifyManagers } from "@/lib/push";
import { ensureDeviceId } from "@/lib/device";
import { recordPhone, removeChildFromPhone, removedChildren } from "@/lib/phones";
import {
  COOKIE_OPTS,
  adminCookie,
  adminToken,
  canView,
  currentChildren,
  joinCookie,
  joinToken,
  voterCookie,
  selfCookie,
  isPlayerSelf,
  isTeamAdmin,
} from "@/lib/session";

// Loads the team and checks this browser is allowed in (join code).
async function teamFor(teamId: string): Promise<Team | null> {
  const team = await getTeam(teamId);
  return team && (await canView(team)) ? team : null;
}

async function findGame(team: Team, gameId: string) {
  const { ourGames } = await getLeagueData(team);
  return ourGames.find((g) => g.id === gameId) ?? null;
}

// The child (or children) this phone belongs to; an empty list forgets it.
export async function setChildren(teamId: string, ids: string[], self = false) {
  const team = await teamFor(teamId);
  if (!team) return;
  const store = await cookies();
  // A player picks just themselves; a parent can pick siblings too.
  const deviceId = await ensureDeviceId();
  const removed = await removedChildren(team.id, deviceId);
  const valid = [...new Set(ids)].filter((id) => isActivePlayer(team, id) && !removed.includes(id)).slice(0, self ? 1 : 10);
  if (self) store.set(selfCookie(team.id), "1", COOKIE_OPTS);
  else store.delete(selfCookie(team.id));
  if (!valid.length) store.delete(voterCookie(team.id));
  else store.set(voterCookie(team.id), valid.join(","), COOKIE_OPTS);
  await recordPhone(team.id, deviceId, valid, self, (await headers()).get("user-agent"));
  revalidatePath("/", "layout");
}

// Sets attendance and/or the goalie volunteer slot. Volunteering for goal
// implies the child is playing; marking "Can't make it" clears any goalie slot.
export async function updateAttendance(
  teamId: string,
  gameId: string,
  change: { status: AttendanceStatus } | { goalie: GoalieHalf | null },
  playerId?: string,
) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const children = await currentChildren(team);
  if (!children.length) return { error: "Pick your child first." };
  const voter = playerId ?? children[0];
  if (!children.includes(voter)) return { error: "That’s not your child." };
  if ("status" in change && !["yes", "no", "maybe"].includes(change.status)) return { error: "Invalid status." };
  if ("goalie" in change) {
    if (!team.goalie_enabled) return { error: "Role sign-up is off for this team." };
    if (change.goalie !== null) {
      if (!isSlot(change.goalie)) return { error: "Invalid choice." };
      const { count } = gameParts(team);
      change = { goalie: slotFrom(slotParts(change.goalie, count), count) }; // tidy: "1,2" of 2 halves = "full"
    }
  }
  const game = await findGame(team, gameId);
  if (!game) return { error: "Game not found." };
  if (game.kickoff.getTime() < now().getTime()) return { error: "This game has already started." };

  const existing = (await getAttendance(team.id)).find((a) => a.game_id === gameId && a.player_id === voter);
  let status: AttendanceStatus;
  let goalie: GoalieHalf | null;
  if ("status" in change) {
    status = change.status;
    goalie = status === "no" ? null : (existing?.goalie ?? null);
  } else {
    goalie = change.goalie;
    status = goalie ? "yes" : (existing?.status ?? "yes");
  }
  await setAttendance(team.id, { game_id: gameId, player_id: voter, status, goalie });
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

export async function submitBallot(teamId: string, gameId: string, picks: string[]) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const children = await currentChildren(team);
  const voter = children[0];
  if (!voter) return { error: "Pick your child first." };
  const game = await findGame(team, gameId);
  if (!game) return { error: "Game not found." };
  if (votingState(game) !== "open") return { error: "Voting isn't open for this game." };

  if (picks.length !== 3 || new Set(picks).size !== 3 || !picks.every((p) => isActivePlayer(team, p))) {
    return { error: "Pick three different players." };
  }
  if (picks.some((p) => children.includes(p))) return { error: "You can't vote for your own child." };
  const absent = (await getAttendance(team.id))
    .filter((a) => a.game_id === gameId && a.status === "no")
    .map((a) => a.player_id);
  if (picks.some((p) => absent.includes(p))) return { error: "One of those players didn't play." };

  await upsertBallot(team.id, { game_id: gameId, voter_id: voter, first: picks[0], second: picks[1], third: picks[2] });
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

export async function enterJoinCode(_: unknown, formData: FormData) {
  const team = await getTeam(String(formData.get("team") ?? ""));
  if (!team) return { error: "Team not found." };
  const token = joinToken(team);
  if (!token) return { ok: true };
  const locked = await lockedMessage("join", team.id);
  if (locked) return { error: locked };
  if (!verifySecret(String(formData.get("code") ?? ""), team.join_code_hash)) {
    await recordFailure("join", team.id);
    return { error: "That code isn't right." };
  }
  await recordSuccess("join", team.id);
  (await cookies()).set(joinCookie(team.id), token, COOKIE_OPTS);
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

/** Tells a team's managers someone kept getting its PIN wrong (that device is now locked out). */
async function warnManagers(teamId: string, teamName: string) {
  after(() =>
    notifyManagers(teamId, {
      title: `${teamName}: manager PIN`,
      body: "Someone entered a wrong PIN 5 times. They’re locked out for 15 minutes. If it wasn’t a manager, consider changing the PIN.",
      url: `/${teamId}/admin`,
      icon: `/${teamId}/icon/192`,
    }),
  );
}

// Accepts this team's own manager PIN only. (The Sidelnr owner PIN works only
// on /super, so a team PIN can never unlock other teams.)
export async function adminLogin(_: unknown, formData: FormData) {
  const team = await getTeam(String(formData.get("team") ?? ""));
  if (!team) return { error: "Team not found." };
  const pin = String(formData.get("pin") ?? "").trim();
  const store = await cookies();
  const superPin = process.env.ADMIN_PIN?.trim();
  const locked = await lockedMessage("pin", team.id);
  if (locked) return { error: locked };
  if (verifySecret(pin, team.admin_pin_hash)) {
    await recordSuccess("pin", team.id);
    store.set(adminCookie(team.id), adminToken(team)!, COOKIE_OPTS);
  } else if (superPin && pin === superPin) {
    return { error: "That’s the Sidelnr owner PIN, which isn’t used here. Enter this team’s own manager PIN (its owner sets it under My Team, by editing the team), or use sidelnr.app/super." };
  } else {
    if (await recordFailure("pin", team.id)) await warnManagers(team.id, team.name);
    return { error: "Wrong PIN." };
  }
  revalidatePath(`/${team.id}/admin`);
  return { ok: true };
}

/** The team page checks in (at most once a day): records which children this phone follows. */
export async function checkInPhone(teamId: string) {
  const team = await teamFor(teamId);
  if (!team) return;
  const deviceId = await ensureDeviceId();
  await recordPhone(team.id, deviceId, await currentChildren(team), await isPlayerSelf(team), (await headers()).get("user-agent"));
}

/** Manager's Corner: take a child off one phone (it can't pick them again). */
export async function removePhoneChild(teamId: string, deviceId: string, childId: string) {
  const team = await getTeam(teamId);
  if (!team || !(await isTeamAdmin(team))) return;
  await removeChildFromPhone(team.id, deviceId, childId);
  revalidatePath(`/${team.id}/admin`);
}

// A parent's answer for a training session ("can come" / maybe / can't).
export async function updateTrainingAttendance(teamId: string, sessionId: string, status: AttendanceStatus, playerId: string) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  if (!(await currentChildren(team)).includes(playerId)) return { error: "Pick your child first." };
  if (!["yes", "no", "maybe"].includes(status)) return { error: "Invalid answer." };
  const session = (await listTraining(team.id)).find((t) => t.id === sessionId);
  if (!session || session.cancelled) return { error: "This session isn’t on." };
  if (new Date(session.starts_at).getTime() < now().getTime()) return { error: "This session has already started." };
  await setAttendance(team.id, { game_id: sessionId, player_id: playerId, status, goalie: null });
  revalidatePath(`/${team.id}`);
  revalidatePath("/me");
  return { ok: true };
}

// ---------- duty roster (parents) ----------

// "I'll do it": the family takes a duty for a game; "Undo" gives it back.
export async function volunteerForDuty(teamId: string, gameId: string, duty: string, take: boolean) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const children = await currentChildren(team);
  if (!children.length) return { error: "Pick your child first." };
  if (!(await listDuties(team.id)).includes(duty)) return { error: "That duty doesn’t exist." };
  const game = await findGame(team, gameId);
  if (!game || game.kickoff.getTime() < now().getTime()) return { error: "That game has already started." };
  if (take) {
    if (!(await takeDuty(team.id, gameId, duty, children[0]))) return { error: "Someone just took that one." };
  } else {
    const mine = (await listDutySignups(team.id)).find((d) => d.game_id === gameId && d.duty === duty);
    if (!mine || !children.includes(mine.player_id)) return { error: "That’s not yours to give back." };
    await releaseDuty(team.id, gameId, duty);
  }
  revalidatePath(`/${team.id}`);
  return { ok: true };
}

// A family leaves a team on this phone: forgets the team code and the children
// picked, and stops this phone's notifications for the team.
export async function leaveTeam(teamId: string, pushEndpoint: string | null) {
  const team = await getTeam(teamId);
  if (!team) return;
  const store = await cookies();
  store.delete(voterCookie(team.id));
  store.delete(selfCookie(team.id));
  store.delete(joinCookie(team.id));
  store.delete(adminCookie(team.id)); // the team PIN on this device too, or home keeps listing the team
  if (team.id === "storm-united") store.delete("su_voter"); // from before teams had their own links
  if (pushEndpoint) await deletePushSub(team.id, pushEndpoint);
  revalidatePath("/", "layout");
  redirect("/", RedirectType.replace);
}
