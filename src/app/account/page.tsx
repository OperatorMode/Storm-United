import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimTeamForm } from "./ClaimTeamForm";
import { signOut } from "./actions";
import { currentManager, isSuperAdmin } from "@/lib/session";
import { managedTeams } from "@/lib/accounts";
import { getTeam } from "@/lib/teams";
import { competitionLabel, getCompetition } from "@/lib/league";
import { logoSrc } from "@/lib/brand";

export const metadata: Metadata = { title: "My teams · Sidelnr", robots: { index: false } };

export default async function AccountPage() {
  const manager = await currentManager();
  if (!manager) redirect("/login?next=/account");

  const [links, superAdmin] = await Promise.all([managedTeams(manager.id), isSuperAdmin()]);
  const teams = (
    await Promise.all(
      links.map(async (l) => {
        const team = await getTeam(l.team_id);
        const competition = team?.competition_id ? await getCompetition(team.competition_id) : null;
        return team ? { team, role: l.role, label: competition ? competitionLabel(competition) : "" } : null;
      }),
    )
  ).filter((t) => t !== null);

  return (
    <div className="min-h-dvh">
      <header className="jersey px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Sidelnr<span className="text-accent">.</span>
          </Link>
          <form action={signOut}>
            <button className="text-sm opacity-70 underline">Sign out</button>
          </form>
        </div>
        <div className="mx-auto mt-4 max-w-md">
          <h1 className="text-xl font-semibold">My teams</h1>
          <p className="text-sm opacity-70">{manager.email}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {teams.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            No teams yet. Already manage a team on Sidelnr? Add it below with its manager PIN.
          </p>
        )}

        {teams.map(({ team, role, label }) => (
          <div key={team.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc(team)} alt="" className="size-11 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{team.name}</div>
                <div className="truncate text-xs text-zinc-500">
                  {label} · {role === "owner" ? "Owner" : "Manager"}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
              <Link href={`/${team.id}`} className="rounded-lg border border-zinc-300 py-2">
                Team page
              </Link>
              <Link href={`/${team.id}/admin`} className="rounded-lg bg-zinc-900 py-2 font-medium text-white">
                Manager’s Corner
              </Link>
            </div>
          </div>
        ))}

        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Add a team you manage</h2>
          <p className="mb-3 mt-0.5 text-sm text-zinc-500">Enter the team’s code or name and its manager PIN.</p>
          <ClaimTeamForm />
        </section>

        {superAdmin && (
          <Link href="/super" className="block text-center text-sm text-zinc-500 underline">
            Super admin · All teams
          </Link>
        )}
      </main>
    </div>
  );
}
