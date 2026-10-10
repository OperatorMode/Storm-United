import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { db } from "./store";

// The owner page (/super) signs in with Supabase Auth: email + password, then a
// 6-digit code from an authenticator app (TOTP). Only accounts marked as the
// owner (app_metadata.sidelnr_owner = true, which only the database can set)
// get in. After both steps the app keeps its own signed owner session
// (session.ts); Supabase isn't asked again until it expires.

export const OWNER_FLAG = "sidelnr_owner";

/** A throwaway Supabase client for one sign-in step (never the shared one). */
export function ownerAuthClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export const ownerLoginAvailable = () => !!process.env.SUPABASE_URL && !!(process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

type MaybeOwner = { app_metadata?: Record<string, unknown>; banned_until?: string | null };

export function isOwnerUser(user: MaybeOwner | null | undefined): boolean {
  if (!user || user.app_metadata?.[OWNER_FLAG] !== true) return false;
  return !user.banned_until || new Date(user.banned_until).getTime() < Date.now();
}

/** Is this Supabase user (still) the owner? Removing the flag or the user locks them out at once. */
export async function ownerStillValid(userId: string): Promise<boolean> {
  const s = db();
  if (!s) return false;
  try {
    const { data, error } = await s.auth.admin.getUserById(userId);
    return !error && isOwnerUser(data.user);
  } catch {
    return false;
  }
}
