"use server";

import { cookies } from "next/headers";
import { createHmac, randomInt } from "crypto";
import { ownerCodeEmail, sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteTeam, setAttendance } from "@/lib/store";
import { applyTeamForm } from "@/lib/team-form";
import { getLeagueData, nextGame } from "@/lib/league";
import { ackAnnouncement, addAnnouncement, addChat, listAnnouncements, listChat } from "@/lib/messages";
import { getTeam } from "@/lib/teams";
import { COOKIE_OPTS, OWNER_COOKIE, OWNER_SESSION_HOURS, SUPER_COOKIE, isSuperAdmin, ownerSessionValue, superToken } from "@/lib/session";
import { isOwnerUser, ownerAuthClient } from "@/lib/owner-auth";
import { decideReview, unverifyLeague } from "@/lib/league-verify";
import { setFeedbackDone } from "@/lib/feedback";
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

export async function saveTeam(_: unknown, formData: FormData) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  const editingId = String(formData.get("existing_id") ?? "").trim() || null;
  const res = await applyTeamForm(formData, { editingId, lockCompetition: false, allowTakenTeam: true });
  if ("error" in res) return res;
  revalidatePath("/super");
  revalidatePath(`/${res.id}`, "layout");
  redirect(`/super?saved=${res.id}`);
}

export async function removeTeam(id: string) {
  if (!(await isSuperAdmin())) return;
  await deleteTeam(id);
  revalidatePath("/super");
  redirect("/super");
}

// Fills a team (e.g. a demo team) with believable sample activity: attendance
// and goalie volunteers for the next game, two coach posts with acknowledgements,
// and a short parents' chat. Only for teams with no messages yet.
export async function fillSampleData(teamId: string) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  const team = await getTeam(teamId);
  if (!team) return { error: "Team not found." };
  const p = team.players.map((x) => x.id);
  if (p.length < 6) return { error: "Add at least 6 players first." };
  if ((await listAnnouncements(team.id)).length || (await listChat(team.id)).length) {
    return { error: "This team already has messages. Sample data only goes into an empty team." };
  }

  const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();
  const name = (id: string) => team.players.find((x) => x.id === id)!.name.split(" ")[0];

  const next = nextGame((await getLeagueData(team)).ourGames);
  if (next && next.kickoff.getTime() > Date.now()) {
    const status = (i: number) => (i === p.length - 1 ? "no" : i === p.length - 2 ? "maybe" : i < p.length - 3 ? "yes" : null);
    for (const [i, id] of p.entries()) {
      const s = status(i);
      if (!s) continue; // leave one family who hasn't replied yet
      await setAttendance(team.id, { game_id: next.id, player_id: id, status: s, goalie: i === 0 ? "1st" : i === 1 ? "2nd" : null });
    }
  }

  const welcome = await addAnnouncement(
    team.id,
    "Welcome to our team app.\nPlease mark attendance for each game by Sunday night, and vote for MVP after every match. Shin pads every game!",
    ago(50),
  );
  for (const id of p.slice(0, -2)) await ackAnnouncement(team.id, welcome, id);
  const reminder = await addAnnouncement(
    team.id,
    `Reminder: we meet ${team.meet_minutes || 30} minutes before kick-off for warm-up. Bring a water bottle and your black socks.`,
    ago(3),
  );
  for (const id of p.slice(0, 3)) await ackAnnouncement(team.id, reminder, id);

  const chat: [string, string, number][] = [
    [p[2], "Hi all! Can anyone help with a lift on Monday? We’re coming from Byford.", 20],
    [p[4], `We can take ${name(p[2])}, we drive past anyway`, 19.5],
    [p[2], "Legend, thank you!", 19.4],
    ["coach", "Great energy at training this week everyone. Let’s keep it up on Monday.", 6],
    [p[1], `${name(p[1])} is super keen to go in goal again.`, 5],
  ];
  for (const [author, body, hours] of chat) await addChat(team.id, author, body, ago(hours));

  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}

// ---------- official leagues ----------

export async function decideLeagueReview(claimId: string, approve: boolean) {
  if (!(await isSuperAdmin())) return;
  await decideReview(claimId, approve);
  revalidatePath("/", "layout");
}

export async function removeLeagueVerification(leagueId: string) {
  if (!(await isSuperAdmin())) return;
  await unverifyLeague(leagueId);
  revalidatePath("/", "layout");
}

/** Owner page: mark feedback as dealt with (or open it again). */
export async function markFeedback(id: string, done: boolean) {
  if (!(await isSuperAdmin())) return;
  await setFeedbackDone(id, done);
  revalidatePath("/super");
}
