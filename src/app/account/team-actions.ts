"use server";

import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { applyTeamForm, deleteTeam } from "@/lib/team-form";
import { linkManager, managedTeams } from "@/lib/accounts";
import { currentManagerId } from "@/lib/session";

// Self-serve team management for signed-in managers.

export async function createMyTeam(_: unknown, formData: FormData) {
  const managerId = await currentManagerId();
  if (!managerId) return { error: "Sign in first." };
  const res = await applyTeamForm(formData, { editingId: null, lockCompetition: false, allowTakenTeam: false });
  if ("error" in res) return res;
  await linkManager(res.id, managerId); // creator becomes the owner
  revalidatePath("/account");
  redirect(`/${res.id}/admin?created=1`);
}

async function myRole(teamId: string): Promise<"owner" | "manager" | null> {
  const managerId = await currentManagerId();
  if (!managerId) return null;
  return (await managedTeams(managerId)).find((t) => t.team_id === teamId)?.role ?? null;
}

export async function updateMyTeam(teamId: string, _: unknown, formData: FormData) {
  if (!(await myRole(teamId))) return { error: "You don’t manage this team." };
  const res = await applyTeamForm(formData, { editingId: teamId, lockCompetition: true, allowTakenTeam: false });
  if ("error" in res) return res;
  revalidatePath(`/${teamId}`, "layout");
  revalidatePath("/account");
  redirect("/account?saved=1");
}

export async function deleteMyTeam(teamId: string) {
  if ((await myRole(teamId)) !== "owner") return { error: "Only the team’s owner can delete it." };
  await deleteTeam(teamId);
  revalidatePath("/account");
  redirect("/account", RedirectType.replace); // the deleted team's page leaves the back history
}
