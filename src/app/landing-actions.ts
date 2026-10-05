"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTeam, slugify, teamIdForJoinCode, verifySecret, type Team } from "@/lib/teams";
import { COOKIE_OPTS, SUPER_COOKIE, adminCookie, adminToken, joinCookie, joinToken, superToken } from "@/lib/session";

// Finds a team from what someone typed: its join code, or its name / link.
// A name only gets you to the team's page — a team with a join code still asks for it.
async function lookup(input: string): Promise<{ team: Team; byCode: boolean } | null> {
  const byCode = await teamIdForJoinCode(input);
  if (byCode) {
    const team = await getTeam(byCode);
    if (team) return { team, byCode: true };
  }
  const slug = slugify(input.replace(/^.*sidelnr\.app\//i, ""));
  const team = slug ? await getTeam(slug) : null;
  return team ? { team, byCode: false } : null;
}

export async function joinTeam(_: unknown, formData: FormData) {
  const input = String(formData.get("code") ?? "").trim();
  if (!input) return { error: "Enter your team code.", code: input };
  const found = await lookup(input);
  if (!found) return { error: "We couldn’t find a team with that code. Check with your coach.", code: input };
  if (found.byCode) (await cookies()).set(joinCookie(found.team.id), joinToken(found.team)!, COOKIE_OPTS);
  redirect(`/${found.team.id}`);
}

export async function managerSignIn(_: unknown, formData: FormData) {
  const input = String(formData.get("team") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  // Echo the team back so the form keeps it after an error (forms reset on submit).
  if (!pin) return { error: "Enter your manager PIN.", team: input };
  const store = await cookies();
  const superPin = process.env.ADMIN_PIN?.trim();
  const isSuper = !!superPin && pin === superPin;

  if (!input) {
    if (!isSuper) return { error: "Enter your team code or team name.", team: input };
    store.set(SUPER_COOKIE, superToken()!, COOKIE_OPTS);
    redirect("/super");
  }

  const found = await lookup(input);
  if (!found) return { error: "Team or PIN not recognised.", team: input };
  const { team } = found;
  if (isSuper) store.set(SUPER_COOKIE, superToken()!, COOKIE_OPTS);
  else if (verifySecret(pin, team.admin_pin_hash)) store.set(adminCookie(team.id), adminToken(team)!, COOKIE_OPTS);
  else return { error: "Team or PIN not recognised.", team: input };
  redirect(`/${team.id}/admin`);
}
