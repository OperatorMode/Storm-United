"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySecret } from "@/lib/teams";
import { lookupTeam as lookup } from "@/lib/team-lookup";
import { COOKIE_OPTS, SUPER_COOKIE, adminCookie, adminToken, joinCookie, joinToken, superToken } from "@/lib/session";
import { lockedMessage, recordFailure, recordSuccess } from "@/lib/rate-limit";

export async function joinTeam(_: unknown, formData: FormData) {
  const input = String(formData.get("code") ?? "").trim();
  if (!input) return { error: "Enter your team code.", code: input };
  const locked = await lockedMessage("join", "any");
  if (locked) return { error: locked, code: input };
  const found = await lookup(input);
  if (!found) {
    await recordFailure("join", "any");
    return { error: "We couldn’t find a team with that code. Check with your coach.", code: input };
  }
  if (found.byCode) (await cookies()).set(joinCookie(found.team.id), joinToken(found.team)!, COOKIE_OPTS);
  redirect(`/${found.team.id}`);
}

export async function managerSignIn(_: unknown, formData: FormData) {
  const input = String(formData.get("team") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  // Echo the team back so the form keeps it after an error (forms reset on submit).
  if (!pin) return { error: "Enter your manager PIN.", team: input };
  const locked = await lockedMessage("pin", "sign-in");
  if (locked) return { error: locked, team: input };
  const store = await cookies();
  const superPin = process.env.ADMIN_PIN?.trim();
  const isSuper = !!superPin && pin === superPin;

  if (!input) {
    if (!isSuper) return { error: "Enter your team code or team name.", team: input };
    store.set(SUPER_COOKIE, superToken()!, COOKIE_OPTS);
    redirect("/super");
  }

  const found = await lookup(input);
  if (!found) {
    await recordFailure("pin", "sign-in");
    return { error: "Team or PIN not recognised.", team: input };
  }
  const { team } = found;
  if (verifySecret(pin, team.admin_pin_hash)) {
    await recordSuccess("pin", "sign-in");
    store.set(adminCookie(team.id), adminToken(team)!, COOKIE_OPTS);
  } else if (isSuper) return { error: "That’s the Sidelnr owner PIN, which isn’t used here. Enter this team’s own manager PIN (its owner sets it under My Team, by editing the team), or use sidelnr.app/super.", team: input };
  else {
    await recordFailure("pin", "sign-in");
    return { error: "Team or PIN not recognised.", team: input };
  }
  redirect(`/${team.id}/admin`);
}
