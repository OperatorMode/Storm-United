"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteTeam, setAttendance } from "@/lib/store";
import { applyTeamForm } from "@/lib/team-form";
import { getLeagueData, nextGame } from "@/lib/league";
import { ackAnnouncement, addAnnouncement, addChat, listAnnouncements, listChat } from "@/lib/messages";
import { getTeam } from "@/lib/teams";
import { COOKIE_OPTS, SUPER_COOKIE, isSuperAdmin, superToken } from "@/lib/session";


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
    [p[4], `We can take ${name(p[2])} — we drive past anyway`, 19.5],
    [p[2], "Legend, thank you!", 19.4],
    ["coach", "Great energy at training this week everyone. Let’s keep it up on Monday.", 6],
    [p[1], `${name(p[1])} is super keen to go in goal again.`, 5],
  ];
  for (const [author, body, hours] of chat) await addChat(team.id, author, body, ago(hours));

  revalidatePath(`/${team.id}`, "layout");
  return { ok: true };
}
