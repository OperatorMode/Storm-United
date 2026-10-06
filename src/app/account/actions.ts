"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createLoginToken, isEmail, linkManager, normaliseEmail } from "@/lib/accounts";
import { emailEnabled, loginEmail, sendEmail } from "@/lib/email";
import { lookupTeam } from "@/lib/team-lookup";
import { getTeam, verifySecret } from "@/lib/teams";
import { MANAGER_COOKIE, currentManagerId, isTeamAdmin } from "@/lib/session";

// Only same-site paths are allowed as the post-login destination.
async function safeNext(next: string | null | undefined): Promise<string> {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
}

export async function requestLoginLink(_: unknown, formData: FormData) {
  if (!emailEnabled()) return { error: "Email sign-in isn’t available yet. Use your team PIN for now.", email: "" };
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  if (!isEmail(email)) return { error: "Enter a valid email address.", email };
  const next = await safeNext(String(formData.get("next") ?? ""));

  const token = await createLoginToken(email);
  if (!token) return { error: "Too many sign-in emails. Wait a few minutes and try again.", email };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "sidelnr.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const link = `${proto}://${host}/auth/verify?token=${token}&next=${encodeURIComponent(next)}`;
  const mail = loginEmail(link);
  if (!(await sendEmail(email, mail.subject, mail.text, mail.html))) {
    return { error: "We couldn’t send the email just now. Please try again shortly.", email };
  }
  return { sent: true, email };
}

export async function signOut() {
  (await cookies()).delete(MANAGER_COOKIE);
  redirect("/");
}

// Adds a team to "My teams" using its code/name + manager PIN.
export async function claimTeam(_: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const input = String(formData.get("team") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!input || !pin) return { error: "Enter the team and its manager PIN.", team: input };
  const found = await lookupTeam(input);
  if (!found || !verifySecret(pin, found.team.admin_pin_hash)) {
    return { error: "Team or PIN not recognised.", team: input };
  }
  await linkManager(found.team.id, managerId);
  revalidatePath("/account");
  return { ok: true, name: found.team.name };
}

// For a manager already in a team's Manager's Corner (e.g. via its PIN).
export async function addTeamToAccount(teamId: string) {
  const managerId = await currentManagerId();
  const team = await getTeam(teamId);
  if (!managerId || !team || !(await isTeamAdmin(team))) return;
  await linkManager(team.id, managerId);
  revalidatePath(`/${team.id}/admin`);
  revalidatePath("/account");
}
