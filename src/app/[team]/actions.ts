"use server";

import { after } from "next/server";
import { redirect, RedirectType } from "next/navigation";
import { gameParts, isSlot, slotFrom, slotParts } from "@/lib/role";
import { deletePushSub, getPushSubs } from "@/lib/messages";
import { listTraining } from "@/lib/training";
import { listDuties, listDutySignups, releaseDuty, takeDuty } from "@/lib/duties";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLeagueData, votingState } from "@/lib/league";
import { getTeam, isActivePlayer, verifySecret, type Team } from "@/lib/teams";
import { now } from "@/lib/clock";
import { getAttendance, setAttendance, upsertBallot, type AttendanceStatus, type GoalieHalf } from "@/lib/store";
import { lockedMessage, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { notifyManagers, sendPush } from "@/lib/push";
import { ensureDeviceId } from "@/lib/device";
import { approvePhoneChild, getPhone, ids as idList, phoneByMember, recordPhone, removeChildFromPhone, removedChildren, selfTakenBy, setPhonePerson } from "@/lib/phones";
import { NAME_MAX, RELATION_MAX } from "@/lib/people";
import {
  COOKIE_OPTS,
  adminCookie,
  adminToken,
  canView,
  currentChildren,
  pickedChildren,
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

// Tells the families of these children (their phones with notifications on)
// that a new phone is waiting for their OK.
function askFamilies(team: Team, childIds: string[]) {
  if (!childIds.length) return;
  after(async () => {
    const subs = (await getPushSubs(team.id)).filter((s) => idList(s.children).some((c) => childIds.includes(c)));
    const names = childIds.map((c) => team.players.find((p) => p.id === c)?.name.split(" ")[0]).filter(Boolean).join(" & ");
    await Promise.allSettled(
      subs.map((s) =>
        sendPush(s, {
          title: `${team.name}: a new phone for ${names}`,
          body: "Someone wants to follow your child. Open the team page to let them in, or say Not us.",
          url: `/${team.id}`,
          icon: `/${team.id}/icon/192`,
          tag: `${team.id}-family`,
        }),
      ),
    );
  });
}

// The child (or children) this phone belongs to; an empty list forgets it.
export async function setChildren(teamId: string, ids: string[], self = false) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const store = await cookies();
  // A player picks just themselves; a parent can pick siblings too.
  const deviceId = await ensureDeviceId();
  const removed = await removedChildren(team.id, deviceId);
  const valid = [...new Set(ids)].filter((id) => isActivePlayer(team, id) && !removed.includes(id)).slice(0, self ? 1 : 10);
  // A child whose family (or the coach) took them off this phone can't be picked again here.
  const refused = ids.filter((id) => removed.includes(id));
  if (refused.length && !valid.length) {
    const name = team.players.find((p) => p.id === refused[0])?.name.split(" ")[0] ?? "This player";
    return { error: `${name}’s family said this phone isn’t one of theirs. If that’s a mistake, ask them or the coach.` };
  }
  // A player is one person: only one phone can be them ("I am…").
  if (self && valid[0] && (await selfTakenBy(team.id, valid[0], deviceId))) {
    const name = team.players.find((p) => p.id === valid[0])?.name.split(" ")[0] ?? "This player";
    return { error: `${name} is already on another phone. If that’s wrong, ask the coach to remove it under Connected phones.` };
  }
  if (self) store.set(selfCookie(team.id), "1", COOKIE_OPTS);
  else store.delete(selfCookie(team.id));
  if (!valid.length) store.delete(voterCookie(team.id));
  else store.set(voterCookie(team.id), valid.join(","), COOKIE_OPTS);
  // A child someone else already follows waits for their family's OK.
  askFamilies(team, await recordPhone(team.id, deviceId, valid, self, (await headers()).get("user-agent")));
  revalidatePath("/", "layout");
  return { ok: true };
}

// "I belong to…": who this phone's person is to the children ("Dad", "Friend"…)
// and, if they like, their name. Shown in chat and private messages.
export async function setPerson(teamId: string, relation: string, name: string) {
  const team = await teamFor(teamId);
  if (!team) return { error: "Team not found." };
  const clean = (v: string, max: number) => v.replace(/\s+/g, " ").trim().slice(0, max);
  const rel = clean(relation, RELATION_MAX);
  if (!rel) return { error: "Say who you are to them, e.g. Dad, Mum or Friend." };
  const deviceId = await ensureDeviceId();
  const picked = await pickedChildren(team);
  if (!picked.length) return { error: "Tick your child first." };
  // Make sure this phone is recorded (older phones may not be yet).
  if (!(await getPhone(team.id, deviceId))) askFamilies(team, await recordPhone(team.id, deviceId, picked, false, (await headers()).get("user-agent")));
  await setPhonePerson(team.id, deviceId, rel.charAt(0).toUpperCase() + rel.slice(1), clean(name, NAME_MAX) || null);
  revalidatePath("/", "layout");
  return { ok: true };
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
  askFamilies(team, await recordPhone(team.id, deviceId, await pickedChildren(team), await isPlayerSelf(team), (await headers()).get("user-agent")));
}

/**
 * A family decides about another phone on their child: let a waiting phone in,
 * or "Not us" (taken off, and it can't pick that child again). The coach can
 * do the same from Manager's Corner, for when the family can't (a lost phone).
 * Phones are named by their person (member id), never their private id.
 */
export async function decidePhone(teamId: string, memberId: string, childId: string, letIn: boolean) {
  const team = await getTeam(teamId);
  if (!team) return { error: "Team not found." };
  const family = (await canView(team)) && (await currentChildren(team)).includes(childId);
  const coach = await isTeamAdmin(team);
  if (!family && !coach) return { error: "Only " + (team.players.find((p) => p.id === childId)?.name.split(" ")[0] ?? "the child") + "’s family can do that." };
  const phone = await phoneByMember(team.id, memberId);
  if (!phone || !idList(phone.children).includes(childId)) return { error: "That phone doesn’t follow this child any more." };
  if (letIn) await approvePhoneChild(team.id, phone.device_id, childId);
  else await removeChildFromPhone(team.id, phone.device_id, childId);
  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
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
