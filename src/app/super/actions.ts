"use server";

import { cookies } from "next/headers";
import { createHmac, randomInt } from "crypto";
import { ownerCodeEmail, sendEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { deleteTeam } from "@/lib/store";
import { deleteManagerAccount, unlinkManager } from "@/lib/accounts";
import { clearTeamPin, removeLeagueAdmin } from "@/lib/owner-tools";
import { COOKIE_OPTS, OWNER_COOKIE, OWNER_SESSION_HOURS, SUPER_COOKIE, isSuperAdmin, ownerSessionValue, superToken } from "@/lib/session";
import { isOwnerUser, ownerAuthClient } from "@/lib/owner-auth";
import { decideReview, unverifyLeague } from "@/lib/league-verify";
import { setFeedbackDone } from "@/lib/feedback";
import { cleanUp } from "@/lib/housekeeping";
import { lockedMessage, recordFailure, recordSuccess } from "@/lib/rate-limit";


// ---------- owner sign-in with Supabase: password, then authenticator app ----------

// Between the two steps, the half-finished Supabase session waits here (httpOnly, 10 minutes).
const OWNER_PENDING = "su_owner_pending";
type Pending = { a: string; r: string; f: string };
type OwnerState = { error?: string; step?: "code" | "enroll"; qr?: string; secret?: string; ok?: boolean };

const WRONG_LOGIN = "Wrong email or password.";

export async function ownerSignIn(input: { email?: string; password?: string; code?: string }): Promise<OwnerState> {
  const client = ownerAuthClient();
  if (!client) return { error: "Owner sign-in isn't set up here." };
  const locked = await lockedMessage("super", "owner");
  if (locked) return { error: locked };
  const store = await cookies();

  // Step 2: the 6-digit code from the authenticator app.
  if (input.code !== undefined) {
    const code = input.code.replace(/\D/g, "");
    let pending: Pending | null = null;
    try {
      pending = JSON.parse(Buffer.from(store.get(OWNER_PENDING)?.value ?? "", "base64url").toString());
    } catch {}
    if (!pending?.a || !pending.r || !pending.f) return { error: "That took too long. Sign in again." };
    const { error: sessionError } = await client.auth.setSession({ access_token: pending.a, refresh_token: pending.r });
    if (sessionError) return { error: "That took too long. Sign in again." };
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: pending.f, code });
    if (error || !data) {
      await recordFailure("super", "owner");
      return { error: "That code isn’t right. Use the newest code in your authenticator app." };
    }
    if (!isOwnerUser(data.user)) return { error: "This account isn’t the Sidelnr owner." };
    await recordSuccess("super", "owner");
    store.delete(OWNER_PENDING);
    store.set(OWNER_COOKIE, ownerSessionValue(data.user.id), { ...COOKIE_OPTS, maxAge: OWNER_SESSION_HOURS * 3600 });
    await client.auth.signOut({ scope: "local" }).catch(() => {}); // the app's own owner session takes over
    revalidatePath("/super");
    return { ok: true };
  }

  // Step 1: email and password.
  const email = String(input.email ?? "").trim();
  const password = String(input.password ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await recordFailure("super", "owner");
    return { error: WRONG_LOGIN };
  }
  if (!isOwnerUser(data.user)) {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    await recordFailure("super", "owner");
    return { error: "This account isn’t the Sidelnr owner." };
  }

  // Already set up: ask for the code. First time: show a QR code to add Sidelnr to the app.
  const factors = await client.auth.mfa.listFactors();
  const verified = factors.data?.totp?.[0];
  let factorId = verified?.id;
  let enroll: { qr: string; secret: string } | null = null;
  if (!factorId) {
    for (const f of factors.data?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await client.auth.mfa.unenroll({ factorId: f.id });
    }
    const res = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Sidelnr owner", issuer: "Sidelnr" });
    if (res.error || !res.data) return { error: "Couldn’t start the authenticator set-up. Try again." };
    factorId = res.data.id;
    enroll = { qr: res.data.totp.qr_code, secret: res.data.totp.secret };
  }
  const pending: Pending = { a: data.session.access_token, r: data.session.refresh_token, f: factorId };
  store.set(OWNER_PENDING, Buffer.from(JSON.stringify(pending)).toString("base64url"), { ...COOKIE_OPTS, maxAge: 600 });
  return enroll ? { step: "enroll", ...enroll } : { step: "code" };
}

// ---------- the old owner PIN (only while ADMIN_PIN is set in Vercel) ----------

// The owner page takes two steps: the owner PIN, then a 6-digit code emailed
// to OWNER_EMAIL (while that isn't set, the PIN alone, and the page says so).
// The code waits in a short-lived signed cookie, never in the page.
const PENDING_COOKIE = "su_super_pending";
const CODE_MINUTES = 10;
const sign = (v: string) => createHmac("sha256", `super:${superToken() ?? ""}`).update(v).digest("hex");

export async function superLogin(_: unknown, formData: FormData): Promise<{ error?: string; ok?: boolean; codeSent?: string } | null> {
  const token = superToken();
  if (!token) return { error: "ADMIN_PIN isn't configured." };
  const locked = await lockedMessage("super", "owner");
  if (locked) return { error: locked };
  const store = await cookies();
  const ownerEmail = process.env.OWNER_EMAIL?.trim();

  // Step 2: the emailed code.
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code) {
    const [hash, expires] = (store.get(PENDING_COOKIE)?.value ?? "").split(".");
    if (!hash || !expires || Number(expires) < Date.now()) return { error: "That code has expired. Enter the PIN again for a new one." };
    if (sign(`${code}.${expires}`) !== hash) {
      await recordFailure("super", "owner");
      return { error: "That code isn’t right.", codeSent: "again" };
    }
    await recordSuccess("super", "owner");
    store.delete(PENDING_COOKIE);
    store.set(SUPER_COOKIE, token, COOKIE_OPTS);
    revalidatePath("/super");
    return { ok: true };
  }

  // Step 1: the PIN.
  const pin = String(formData.get("pin") ?? "").trim();
  if (pin !== process.env.ADMIN_PIN?.trim()) {
    await recordFailure("super", "owner");
    return { error: "Wrong PIN." };
  }
  if (!ownerEmail) {
    await recordSuccess("super", "owner");
    store.set(SUPER_COOKIE, token, COOKIE_OPTS);
    revalidatePath("/super");
    return { ok: true };
  }
  const fresh = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = String(Date.now() + CODE_MINUTES * 60_000);
  store.set(PENDING_COOKIE, `${sign(`${fresh}.${expires}`)}.${expires}`, { ...COOKIE_OPTS, maxAge: CODE_MINUTES * 60 });
  const mail = ownerCodeEmail(fresh);
  if (!(await sendEmail(ownerEmail, mail.subject, mail.text, mail.html))) return { error: "Couldn’t send the code email. Try again shortly." };
  const [name, domain] = ownerEmail.split("@");
  return { codeSent: `${name.slice(0, 2)}…@${domain}` };
}

export async function superLogout() {
  const store = await cookies();
  store.delete(SUPER_COOKIE);
  store.delete(OWNER_COOKIE);
  revalidatePath("/super");
}

// ---------- stepping in (the owner never sees inside a team or event) ----------

/** Deletes a team or event, with everything in it. */
export async function removeTeam(id: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await deleteTeam(id);
  revalidatePath("/super");
  return { ok: true };
}

/** Takes a manager (or event organiser) account off a team. The team carries on. */
export async function ownerRemoveManager(teamId: string, managerId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await unlinkManager(teamId, managerId);
  revalidatePath("/super");
  return { ok: true };
}

/** Clears a team's PIN or an event's organiser code: whoever unlocked with it is locked out. */
export async function ownerResetPin(teamId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await clearTeamPin(teamId);
  revalidatePath("/super");
  return { ok: true };
}

/** Takes an admin off an official league. */
export async function ownerRemoveLeagueAdmin(leagueId: string, managerId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await removeLeagueAdmin(leagueId, managerId);
  revalidatePath("/super");
  return { ok: true };
}

/** Deletes a manager account (e.g. they asked, and can't sign in any more). Their teams carry on. */
export async function ownerDeleteManager(managerId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await deleteManagerAccount(managerId);
  revalidatePath("/super");
  return { ok: true };
}

// ---------- official leagues ----------

export async function decideLeagueReview(claimId: string, approve: boolean) {
  if (!(await isSuperAdmin())) return;
  await decideReview(claimId, approve);
  revalidatePath("/", "layout");
}

export async function removeLeagueVerification(leagueId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  await unverifyLeague(leagueId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Owner page: mark feedback as dealt with (or open it again). */
export async function markFeedback(id: string, done: boolean) {
  if (!(await isSuperAdmin())) return;
  await setFeedbackDone(id, done);
  revalidatePath("/super");
}

/** Owner page: remove leftover records (old sign-in links, counters, logs). */
export async function runCleanUp() {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  const removed = await cleanUp();
  revalidatePath("/super");
  return { removed };
}
