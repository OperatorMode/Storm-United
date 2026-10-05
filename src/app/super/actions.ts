"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteTeam, getTeamRow, savePlayers, setAttendance, upsertTeam, uploadLogo, type TeamRow } from "@/lib/store";
import { getLeagueData, leagueTeams, nextGame } from "@/lib/league";
import { ackAnnouncement, addAnnouncement, addChat, listAnnouncements, listChat } from "@/lib/messages";
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
    return { error: "This team already has messages — sample data only goes into an empty team." };
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
    "Welcome to our team app! 🎉\nPlease mark attendance for each game by Sunday night, and vote for MVP after every match. Shin pads every game!",
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
    [p[4], `We can take ${name(p[2])} — we drive past anyway 🙂`, 19.5],
    [p[2], "Legend, thank you!", 19.4],
    ["coach", "Great energy at training this week everyone. Let’s keep it up on Monday ⚽", 6],
    [p[1], `${name(p[1])} is super keen to go in goal again 🧤`, 5],
  ];
  for (const [author, body, hours] of chat) await addChat(team.id, author, body, ago(hours));

  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}
