import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card";
import {
  AddCompetitionForm,
  AddFixtureForm,
  CompetitionSettingsForm,
  DangerZone,
  FeedPanel,
  ImportCsvForm,
  LeagueTimezoneForm,
  PoolDrawForm,
  ResultRow,
  TeamsEditor,
} from "../../leagues/LeagueForms";
import { FixtureWizardLauncher } from "../../leagues/FixtureWizard";
import { currentManagerId, isSuperAdmin } from "@/lib/session";
import { adminLeagueIds, listCompetitionTeamNames, listFixtures } from "@/lib/fixtures";
import { competitionTz, formatDay, getCompetition, listCompetitions } from "@/lib/league";
import { formatTime } from "@/lib/time";
import { isPoolStage } from "@/lib/events";
import { listTeams } from "@/lib/store";
import { now as clockNow } from "@/lib/clock";

export const metadata: Metadata = { title: "Competition · Sidelnr", robots: { index: false } };


export default async function CompetitionAdminPage({ params, searchParams }: PageProps<"/account/competitions/[id]">) {
  const { id } = await params;
  const isNew = (await searchParams).new !== undefined;
  const managerId = await currentManagerId();
  if (!managerId && !(await isSuperAdmin())) redirect(`/login?next=/account/competitions/${id}`);
  const competition = await getCompetition(id);
  if (!competition) notFound();
  const allowed = (await isSuperAdmin()) || (managerId ? (await adminLeagueIds(managerId)).includes(competition.league_id) : false);
  if (!allowed) notFound();

  if (competition.league.source !== "manual") {
    return (
      <div className="mx-auto max-w-md p-4">
        <p className="text-sm text-zinc-500">
          {competition.league.name} gets its fixtures and results from its own website automatically — nothing to edit here.
        </p>
      </div>
    );
  }

  const [teams, fixtures, siblings, allTeams] = await Promise.all([
    listCompetitionTeamNames(id),
    listFixtures(id),
    listCompetitions().then((cs) => cs.filter((c) => c.league_id === competition.league_id)),
    listTeams(),
  ]);
  const sidelnrTeams = allTeams.filter((t) => t.competition_id === id);
  // What deleting would remove (shown in the Danger zone).
  const siblingData = await Promise.all(
    siblings.map(async (c) => ({ fixtures: (await listFixtures(c.id)).length, teams: (await listCompetitionTeamNames(c.id)).length })),
  );
  const leagueImpact = {
    competitions: siblings.length,
    fixtures: siblingData.reduce((n, x) => n + x.fixtures, 0),
    drawTeams: siblingData.reduce((n, x) => n + x.teams, 0),
    sidelnrTeams: allTeams.filter((t) => siblings.some((c) => c.id === t.competition_id)).map((t) => t.name),
  };
  const competitionImpact = { competitions: 1, fixtures: fixtures.length, drawTeams: teams.length, sidelnrTeams: sidelnrTeams.map((t) => t.name) };
  const now = clockNow().getTime();
  const upcoming = fixtures.filter((f) => new Date(f.kickoff).getTime() > now);
  const past = fixtures.filter((f) => new Date(f.kickoff).getTime() <= now).reverse();
  const tz = competitionTz(competition);
  const event = competition.kind === "tournament";
  const poolGames = fixtures.filter((f) => isPoolStage(f.stage)).length;
  // Event finals games can have their teams filled in later.
  const teamsFor = (f: { stage: string | null }) => (event && !isPoolStage(f.stage) ? teams : undefined);
  const when = (iso: string) => `${formatDay(new Date(iso), tz)}, ${formatTime(new Date(iso), tz)}`;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <Link href={event ? "/account/events" : "/account/leagues"}>← {event ? "My events" : "My leagues"}</Link>
        {event && (
          <Link href={`/events/${competition.league_id}`} className="underline">
            Public page ↗
          </Link>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-400">{competition.league.name}</div>
        <h1 className="text-xl font-semibold">{competition.name}</h1>
        {siblings.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {siblings.map((c) => (
              <Link
                key={c.id}
                href={`/account/competitions/${c.id}`}
                className={`rounded-full px-3 py-1 ${c.id === id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {isNew && event && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">{competition.name} is set up</div>
          <p className="mt-1">
            Next: type the pools below and build the draw, then add any finals. Share the public page with everyone on the
            day — results update live. Teams on Sidelnr can pick “{competition.league.name} · {competition.name}” as their
            competition.
          </p>
        </div>
      )}

      {event && (
        <Card title="Pools & draw" aside={poolGames ? `${poolGames} pool games` : undefined}>
          <PoolDrawForm
            competitionId={id}
            teams={teams}
            defaultDate={competition.season && /^\d{4}-\d{2}-\d{2}$/.test(competition.season) ? competition.season : ""}
            existingPoolGames={poolGames}
          />
        </Card>
      )}

      {isNew && !event && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">{competition.name} is set up</div>
          <p className="mt-1">
            Next: add the teams below, then create the fixtures step by step (or import a CSV, or link a spreadsheet). Then teams can join it via <b>My teams → Create a
            team</b> and pick “{competition.league.name} · {competition.name}”.
          </p>
        </div>
      )}

      <Card title="Teams" aside={`${teams.length} in the draw · ${sidelnrTeams.length} on Sidelnr`}>
        <TeamsEditor competitionId={id} teams={teams} />
      </Card>

      {!event && (
        <Card title="Create fixtures" aside="Step by step">
          <FixtureWizardLauncher competitionId={id} teams={teams} venue={competition.league.venue ?? ""} existing={upcoming.length} />
        </Card>
      )}

      {!event && (
      <Card title="Fixtures from a link" aside="Auto-updating">
        <FeedPanel
          competitionId={id}
          aiEnabled={!!process.env.ANTHROPIC_API_KEY}
          tz={tz}
          connected={
            competition.feed_type && competition.feed_url
              ? {
                  type: competition.feed_type,
                  url: competition.feed_url,
                  filter: competition.feed_filter ?? null,
                  team: competition.feed_team ?? null,
                  syncedAt: competition.feed_synced_at ?? null,
                  error: competition.feed_error ?? null,
                }
              : null
          }
        />
      </Card>
      )}

      <Card title="Import fixtures" aside="CSV / spreadsheet">
        <ImportCsvForm competitionId={id} />
      </Card>

      <Card title={event ? "Add a finals game" : "Add a fixture"}>
        <AddFixtureForm
          competitionId={id}
          teams={teams}
          event={event}
          defaultDate={event && competition.season && /^\d{4}-\d{2}-\d{2}$/.test(competition.season) ? competition.season : undefined}
        />
      </Card>

      <Card title="Results" aside={past.length ? "Enter scores after each game" : undefined}>
        {past.length === 0 ? (
          <p className="text-sm text-zinc-500">Played games appear here for you to enter scores.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {past.map((f) => (
              <ResultRow key={f.id} competitionId={id} fixture={f} when={when(f.kickoff)} teams={teamsFor(f)} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Upcoming fixtures" aside={`${upcoming.length}`}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">No upcoming games yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {upcoming.map((f) => (
              <ResultRow key={f.id} competitionId={id} fixture={f} when={when(f.kickoff)} teams={teamsFor(f)} />
            ))}
          </ul>
        )}
      </Card>

      <Card title={event ? "Division settings" : "Competition settings"}>
        <CompetitionSettingsForm competitionId={id} initial={competition} event={event} />
      </Card>

      <Card title="Timezone" aside={tz.replaceAll("_", " ")}>
        <LeagueTimezoneForm competitionId={id} initial={tz} />
      </Card>

      <Card title={`Add a ${event ? "division" : "competition"} to ${competition.league.short_name ?? competition.league.name}`}>
        <AddCompetitionForm leagueId={competition.league_id} event={event} />
      </Card>

      <Card title="Danger zone">
        <DangerZone
          competitionId={id}
          competitionName={competition.name}
          leagueName={competition.league.name}
          noun={siblings.every((c) => c.kind === "tournament") ? "event" : "league"}
          competitionImpact={competitionImpact}
          leagueImpact={leagueImpact}
        />
      </Card>
    </div>
  );
}
