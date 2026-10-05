import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeamForm } from "@/components/TeamForm";
import { deleteMyTeam, updateMyTeam } from "../../team-actions";
import { currentManagerId } from "@/lib/session";
import { managedTeams } from "@/lib/accounts";
import { getTeam } from "@/lib/teams";
import { teamFormData } from "@/lib/team-form-data";

export const metadata: Metadata = { title: "Edit team · Sidelnr", robots: { index: false } };

export default async function EditMyTeamPage({ params }: PageProps<"/account/teams/[id]">) {
  const { id } = await params;
  const managerId = await currentManagerId();
  if (!managerId) redirect(`/login?next=/account/teams/${id}`);
  const role = (await managedTeams(managerId)).find((t) => t.team_id === id)?.role;
  const team = role ? await getTeam(id) : null;
  if (!team) notFound();

  const { competitions, taken } = await teamFormData(team.id);
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <Link href="/account" className="text-sm text-zinc-500">
        ← My teams
      </Link>
      <h1 className="text-xl font-semibold">Edit {team.name}</h1>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <TeamForm
          competitions={competitions}
          taken={taken}
          lockCompetition
          initial={{
            id: team.id,
            name: team.name,
            league_name: team.league_name,
            competition_id: team.competition_id ?? "",
            primary_color: team.primary_color,
            accent_color: team.accent_color,
            logo_url: team.logo_url,
            players: team.players.map((p) => p.name).join("\n"),
            hasAdminPin: !!team.admin_pin_hash,
            hasJoinCode: !!team.join_code_hash,
            meet_minutes: team.meet_minutes,
            goalie_enabled: team.goalie_enabled,
          }}
          save={updateMyTeam.bind(null, team.id)}
          remove={role === "owner" ? deleteMyTeam.bind(null, team.id) : undefined}
        />
      </section>
    </div>
  );
}
