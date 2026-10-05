"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteTeam, getTeamRow, savePlayers, upsertTeam, uploadLogo, type TeamRow } from "@/lib/store";
import { leagueTeams } from "@/lib/league";
import { getTeam, hashSecret, joinCodeFields, mergePlayers, slugify } from "@/lib/teams";
import { isHexColor } from "@/lib/theme";
import { COOKIE_OPTS, SUPER_COOKIE, isSuperAdmin, superToken } from "@/lib/session";

// Paths that already mean something in the app and can't be team slugs.
const RESERVED = new Set(["super", "api", "brand", "icons", "uploads", "_next", "admin"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function superLogin(_: unknown, formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  const token = superToken();
  if (!token) return { error: "ADMIN_PIN isn't configured." };
  if (pin !== process.env.ADMIN_PIN?.trim()) return { error: "Wrong PIN." };
  (await cookies()).set(SUPER_COOKIE, token, COOKIE_OPTS);
  revalidatePath("/super");
  return { ok: true };
}

export async function superLogout() {
  (await cookies()).delete(SUPER_COOKIE);
  revalidatePath("/super");
}

export async function saveTeam(_: unknown, formData: FormData) {
  if (!(await isSuperAdmin())) return { error: "Not authorised." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const editing = get("existing_id");
  const division = get("division");
  const leagueName = get("league_name");
  const name = get("name") || leagueName;
  const id = editing || slugify(get("slug") || name);
  const primary = get("primary_color");
  const accent = get("accent_color");

  const divisions = await leagueTeams();
  if (!divisions[division]?.includes(leagueName)) return { error: "Pick the team as it appears in the TPP draw." };
  if (!id || RESERVED.has(id)) return { error: "Choose a different link name." };
  if (!editing && (await getTeamRow(id))) return { error: `A team already uses /${id}.` };
  if (!isHexColor(primary) || !isHexColor(accent)) return { error: "Pick both colours." };

  const existing = editing ? await getTeam(editing) : null;
  if (editing && !existing) return { error: "Team not found." };

  let logoUrl = existing?.logo_url ?? null;
  const logo = formData.get("logo");
  if (formData.get("remove_logo") === "on") logoUrl = null;
  if (logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(logo.type)) return { error: "Logo must be PNG, JPG or SVG." };
    if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be under 2 MB." };
    logoUrl = await uploadLogo(id, logo);
  }

  const players = mergePlayers(existing?.allPlayers ?? [], get("players").split("\n"));
  if (!players.some((p) => p.active)) return { error: "Add at least one player." };

  const adminPin = get("admin_pin");
  const joinCode = get("join_code");
  if (adminPin && adminPin.length < 4) return { error: "Admin PIN needs at least 4 characters." };
  const join = await joinCodeFields(id, { code: joinCode, clear: formData.get("clear_join") === "on" }, existing);
  if ("error" in join) return { error: join.error };
  const meet = Number(get("meet_minutes") || 30);
  if (!Number.isInteger(meet) || meet < 0 || meet > 120) return { error: "Meeting time must be 0–120 minutes." };

  const row: TeamRow = {
    id,
    name,
    league_name: leagueName,
    division,
    primary_color: primary.toLowerCase(),
    accent_color: accent.toLowerCase(),
    logo_url: logoUrl,
    admin_pin_hash: adminPin ? hashSecret(adminPin) : (existing?.admin_pin_hash ?? null),
    ...join,
    meet_minutes: meet,
    goalie_enabled: formData.get("goalie_enabled") === "on",
  };
  await upsertTeam(row);
  await savePlayers(id, players);
  revalidatePath("/super");
  revalidatePath(`/${id}`);
  revalidatePath(`/${id}/admin`);
  redirect(`/super?saved=${id}`);
}

export async function removeTeam(id: string) {
  if (!(await isSuperAdmin())) return;
  await deleteTeam(id);
  revalidatePath("/super");
  redirect("/super");
}
