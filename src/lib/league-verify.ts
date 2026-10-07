import { createHash, randomInt, randomUUID } from "crypto";
import { check, db, readLocal, writeLocal, type LeagueRow } from "./store";
import { updateLeague } from "./fixtures";
import { siteOf } from "./league-scan";

// Official (verified) leagues: only these can send league announcements.
// Anyone can create or import a league, so it has to be claimed:
//   - "email": a one-time code sent to an address on the league's own domain
//     (two-step: the code proves the person can open that inbox);
//   - "review": a Sidelnr super admin approves the request.
// Same pattern as store.ts: Supabase in production, a local JSON file in dev.

export type LeagueClaim = {
  id: string;
  league_id: string;
  manager_id: string;
  kind: "email" | "review";
  email: string | null;
  code_hash: string | null;
  attempts: number;
  expires_at: string | null;
  note: string | null;
  status: "pending" | "approved" | "declined" | "used" | "expired";
  created_at: string;
};

const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 5; // per league

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export function isVerified(league: Pick<LeagueRow, "verified_at">): boolean {
  return !!league.verified_at;
}

/** The domains an official email may use: the league's website and fixture links ("wnbl.com.au"). */
export function officialDomains(league: Pick<LeagueRow, "website">, feedUrls: (string | null | undefined)[] = []): string[] {
  const out = new Set<string>();
  for (const u of [league.website, ...feedUrls]) {
    try {
      if (u) out.add(siteOf(u));
    } catch {}
  }
  // Domains anyone can get an address on never count.
  return [...out].filter((d) => !PUBLIC_EMAIL.has(d));
}

const PUBLIC_EMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.au",
  "icloud.com",
  "me.com",
  "bigpond.com",
  "bigpond.net.au",
  "optusnet.com.au",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
]);

/** Whether an email is on one of the league's own domains (the domain itself or a subdomain). */
export function emailOnDomains(email: string, domains: string[]): boolean {
  const at = email.trim().toLowerCase().split("@")[1] ?? "";
  return !!at && domains.some((d) => at === d || at.endsWith(`.${d}`));
}

async function listClaims(filter: (c: LeagueClaim) => boolean, q?: { league?: string; status?: string }): Promise<LeagueClaim[]> {
  const s = db();
  if (!s) return ((await readLocal()).league_claims ?? []).filter(filter).sort((a, b) => b.created_at.localeCompare(a.created_at));
  let query = s.from("league_claims").select("*").order("created_at", { ascending: false }).limit(200);
  if (q?.league) query = query.eq("league_id", q.league);
  if (q?.status) query = query.eq("status", q.status);
  return (check(await query) as LeagueClaim[]).filter(filter);
}

async function saveClaim(claim: LeagueClaim): Promise<void> {
  const s = db();
  if (!s) {
    const d = await readLocal();
    d.league_claims = [...(d.league_claims ?? []).filter((c) => c.id !== claim.id), claim];
    return writeLocal(d);
  }
  check(await s.from("league_claims").upsert(claim, { onConflict: "id" }));
}

export async function leagueClaims(leagueId: string): Promise<LeagueClaim[]> {
  return listClaims((c) => c.league_id === leagueId, { league: leagueId });
}

/** Review requests waiting for the super admin. */
export async function pendingReviews(): Promise<LeagueClaim[]> {
  return listClaims((c) => c.kind === "review" && c.status === "pending", { status: "pending" });
}

/** Starts an email claim: returns the code to email, or an error. */
export async function startEmailClaim(
  league: LeagueRow,
  domains: string[],
  managerId: string,
  email: string,
): Promise<{ code: string } | { error: string }> {
  const addr = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return { error: "That doesn’t look like an email address." };
  if (!domains.length) return { error: "This league has no website of its own to check against. Request a review instead." };
  if (!emailOnDomains(addr, domains)) {
    return { error: `Use an email address on the league’s own domain (${domains.map((d) => `@${d}`).join(" or ")}), or request a review.` };
  }
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (await leagueClaims(league.id)).filter((c) => c.kind === "email" && new Date(c.created_at).getTime() > hourAgo);
  if (recent.length >= MAX_CODES_PER_HOUR) return { error: "Too many codes sent for this league. Try again in an hour." };
  // A new code replaces any earlier one still waiting.
  for (const c of recent.filter((c) => c.status === "pending")) await saveClaim({ ...c, status: "expired" });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await saveClaim({
    id: randomUUID(),
    league_id: league.id,
    manager_id: managerId,
    kind: "email",
    email: addr,
    code_hash: hash(code),
    attempts: 0,
    expires_at: new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString(),
    note: null,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  return { code };
}

/** Checks the code; on success the league is verified. */
export async function confirmEmailClaim(leagueId: string, managerId: string, code: string): Promise<{ ok: true } | { error: string }> {
  const claim = (await leagueClaims(leagueId)).find((c) => c.kind === "email" && c.status === "pending" && c.manager_id === managerId);
  if (!claim) return { error: "No code waiting. Send a new one." };
  if (!claim.expires_at || new Date(claim.expires_at).getTime() < Date.now()) {
    await saveClaim({ ...claim, status: "expired" });
    return { error: "That code has expired. Send a new one." };
  }
  if (claim.attempts >= MAX_ATTEMPTS) {
    await saveClaim({ ...claim, status: "expired" });
    return { error: "Too many wrong tries. Send a new code." };
  }
  if (hash(code.replace(/\D/g, "")) !== claim.code_hash) {
    await saveClaim({ ...claim, attempts: claim.attempts + 1 });
    const left = MAX_ATTEMPTS - claim.attempts - 1;
    return { error: left > 0 ? `That code isn’t right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Send a new code." };
  }
  await saveClaim({ ...claim, status: "used" });
  await updateLeague(leagueId, { verified_at: new Date().toISOString(), verified_by: claim.email });
  return { ok: true };
}

export async function requestReview(leagueId: string, managerId: string, note: string): Promise<{ ok: true } | { error: string }> {
  const text = note.trim().slice(0, 1000);
  if (text.length < 10) return { error: "Tell us a little about your role in the league." };
  if ((await leagueClaims(leagueId)).some((c) => c.kind === "review" && c.status === "pending")) {
    return { error: "A review is already waiting for this league." };
  }
  await saveClaim({
    id: randomUUID(),
    league_id: leagueId,
    manager_id: managerId,
    kind: "review",
    email: null,
    code_hash: null,
    attempts: 0,
    expires_at: null,
    note: text,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  return { ok: true };
}

/** Super admin: approve or decline a review request. */
export async function decideReview(claimId: string, approve: boolean): Promise<void> {
  const claim = (await listClaims((c) => c.id === claimId)).find((c) => c.id === claimId);
  if (!claim || claim.status !== "pending") return;
  await saveClaim({ ...claim, status: approve ? "approved" : "declined" });
  if (approve) await updateLeague(claim.league_id, { verified_at: new Date().toISOString(), verified_by: "review" });
}

export async function unverifyLeague(leagueId: string): Promise<void> {
  await updateLeague(leagueId, { verified_at: null, verified_by: null });
}
