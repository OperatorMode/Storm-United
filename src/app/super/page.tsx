import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/Card";
import { SuperLogin } from "./SuperLogin";
import { TeamForm } from "@/components/TeamForm";
import { removeTeam, saveTeam } from "./actions";
import { SampleDataButton } from "./SampleDataButton";
import { decideLeagueReview, removeLeagueVerification, superLogout } from "./actions";
import { pendingReviews } from "@/lib/league-verify";
import { getManager } from "@/lib/accounts";
import { listLeagues } from "@/lib/store";
import { isSuperAdmin } from "@/lib/session";
import { listTeams } from "@/lib/store";
import { getTeam } from "@/lib/teams";
import { competitionLabel, listCompetitions } from "@/lib/league";
import { logoSrc } from "@/lib/brand";
import { SidelnrLink } from "@/components/SidelnrLink";

export const metadata: Metadata = { title: "All teams · Admin", robots: { index: false } };

// Finding the squad on the league's website can take a minute or two.
export const maxDuration = 300;

export default async function SuperPage({ searchParams }: PageProps<"/super">) {
  if (!(await isSuperAdmin())) {
    return (
      <div className="mx-auto max-w-md p-4 pt-10">
        <Card title="Super admin">
          <SuperLogin twoStep={!!process.env.OWNER_EMAIL?.trim()} />
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;
  const creating = params.new !== undefined;
  const saved = typeof params.saved === "string" ? params.saved : null;

  const [teams, competitions, leagues, reviews] = await Promise.all([listTeams(), listCompetitions(), listLeagues(), pendingReviews()]);
  // Who asked for each review (their sign-in email).
  const reviewers = Object.fromEntries(
    await Promise.all(reviews.map(async (r) => [r.manager_id, (await getManager(r.manager_id))?.email ?? null] as const)),
  ) as Record<string, string | null>;
  const labelOf = (id: string | null) => {
    const c = competitions.find((x) => x.id === id);
    return c ? competitionLabel(c) : "No competition";
  };
  const editing = editId ? await getTeam(editId) : null;

  if (creating || editing) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <div className="flex items-center justify-between gap-3 text-sm text-zinc-500">
          <SidelnrLink className="text-zinc-900" />
          <Link href="/super">← All teams</Link>
        </div>
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
                role_name: editing.role_name ?? null,
                game_parts: editing.game_parts ?? 2,
                part_name: editing.part_name ?? "Half",
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
        <SidelnrLink className="" />
        <form action={superLogout}>
          <button className="text-sm text-zinc-500">Lock</button>
        </form>
      </div>
      <h1 className="text-lg font-semibold">All teams</h1>

      {saved && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved /{saved}.</p>}

      {/* Official leagues: review requests to approve, and verified leagues (can be revoked). */}
      {(() => {
        const nameOf = (leagueId: string) => leagues.find((l) => l.id === leagueId)?.name ?? leagueId;
        const official = leagues.filter((l) => l.verified_at);
        return (
          <Card title="Official leagues" aside={reviews.length ? `${reviews.length} to review` : undefined}>
            <div className="space-y-4 text-sm">
              {reviews.map((r) => (
                <div key={r.id} className="space-y-2 rounded-xl bg-amber-50 p-3">
                  <div className="font-semibold">{nameOf(r.league_id)}</div>
                  <div className="text-xs text-zinc-600">From {reviewers[r.manager_id] ?? "unknown"} · {r.created_at.slice(0, 10)}</div>
                  <p className="whitespace-pre-wrap break-words">{r.note}</p>
                  <div className="flex gap-2">
                    <form action={decideLeagueReview.bind(null, r.id, true)}>
                      <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                    </form>
                    <form action={decideLeagueReview.bind(null, r.id, false)}>
                      <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs">Decline</button>
                    </form>
                  </div>
                </div>
              ))}
              {official.length ? (
                <ul className="divide-y divide-zinc-100">
                  {official.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">✓ {l.name}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {l.verified_by === "review" ? "Approved by review" : `Verified with ${l.verified_by}`}
                        </span>
                      </span>
                      <form action={removeLeagueVerification.bind(null, l.id)}>
                        <button className="shrink-0 text-xs text-red-700 underline">Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                !reviews.length && <p className="text-zinc-500">No official leagues yet.</p>
              )}
            </div>
          </Card>
        );
      })()}

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
