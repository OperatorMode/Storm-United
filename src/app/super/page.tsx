import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { SuperLogin } from "./SuperLogin";
import { TeamForm } from "@/components/TeamForm";
import { removeTeam, saveTeam } from "./actions";
import { SampleDataButton } from "./SampleDataButton";
import { superLogout } from "./actions";
import { isSuperAdmin } from "@/lib/session";
import { listTeams } from "@/lib/store";
import { getTeam } from "@/lib/teams";
import { competitionLabel, listCompetitions } from "@/lib/league";
import { logoSrc } from "@/lib/brand";

export const metadata: Metadata = { title: "All teams · Admin", robots: { index: false } };

// Finding the squad on the league's website can take a minute or two.
export const maxDuration = 300;

export default async function SuperPage({ searchParams }: PageProps<"/super">) {
  if (!(await isSuperAdmin())) {
    return (
      <div className="mx-auto max-w-md p-4 pt-10">
        <Card title="Super admin">
          <SuperLogin />
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const creating = params.new !== undefined;
  const saved = typeof params.saved === "string" ? params.saved : null;

  const [teams, competitions] = await Promise.all([listTeams(), listCompetitions()]);
  const labelOf = (id: string | null) => {
    const c = competitions.find((x) => x.id === id);
    return c ? competitionLabel(c) : "No competition";
  };
  const editing = editId ? await getTeam(editId) : null;

  if (creating || editing) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <Link href="/super" className="text-sm text-zinc-500">
          ← All teams
        </Link>
        <Card title={editing ? `Edit ${editing.name}` : "New team"}>
          <TeamForm
            competitionLabel={editing ? labelOf(editing.competition_id) : null}
            save={saveTeam}
            remove={editing ? removeTeam.bind(null, editing.id) : undefined}
            allowTaken
            initial={
              editing && {
                id: editing.id,
                name: editing.name,
                league_name: editing.league_name,
                competition_id: editing.competition_id ?? "",
                primary_color: editing.primary_color,
                accent_color: editing.accent_color,
                logo_url: editing.logo_url,
                players: editing.players.map((p) => p.name).join("\n"),
                hasAdminPin: !!editing.admin_pin_hash,
                hasJoinCode: !!editing.join_code_hash,
                meet_minutes: editing.meet_minutes,
                goalie_enabled: editing.goalie_enabled,
              }
            }
          />
        </Card>
        {editing && (
          <Card title="Demo tools">
            <SampleDataButton teamId={editing.id} />
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">All teams</h1>
        <form action={superLogout}>
          <button className="text-sm text-zinc-500">Lock</button>
        </form>
      </div>

      {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved /{saved}.</p>}

      <Link href="/super?new" className="block rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white">
        + Add a team
      </Link>

      <ul className="space-y-3">
        {teams.map((t) => (
          <li key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc(t)} alt="" className="size-11 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{t.name}</div>
                <div className="truncate text-xs text-zinc-500">
                  {labelOf(t.competition_id)} · /{t.id}
                </div>
              </div>
              <span className="size-4 shrink-0 rounded-full border border-zinc-300" style={{ background: t.primary_color }} />
              <span className="size-4 shrink-0 rounded-full border border-zinc-300" style={{ background: t.accent_color }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-500">
              <span>{t.join_code_hash ? "Join code set" : "No join code"}</span>
              <span>{t.admin_pin_hash ? "Team PIN set" : "No team PIN"}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <Link href={`/${t.id}`} className="rounded-lg border border-zinc-300 py-1.5">
                Open
              </Link>
              <Link href={`/${t.id}/admin`} className="rounded-lg border border-zinc-300 py-1.5">
                Admin
              </Link>
              <Link href={`/super?edit=${t.id}`} className="rounded-lg border border-zinc-300 py-1.5">
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
