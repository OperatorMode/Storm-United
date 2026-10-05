import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card";
import {
  AddCompetitionForm,
  AddFixtureForm,
  CompetitionSettingsForm,
  ImportCsvForm,
  ResultRow,
  TeamsEditor,
} from "../../leagues/LeagueForms";
import { currentManagerId, isSuperAdmin } from "@/lib/session";
import { adminLeagueIds, listCompetitionTeamNames, listFixtures } from "@/lib/fixtures";
import { formatDay, getCompetition, listCompetitions } from "@/lib/league";
import { listTeams } from "@/lib/store";
import { now as clockNow } from "@/lib/clock";

export const metadata: Metadata = { title: "Competition · Sidelnr", robots: { index: false } };

const TIME = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", hour: "numeric", minute: "2-digit", hour12: true });

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

  const [teams, fixtures, siblings, sidelnrTeams] = await Promise.all([
    listCompetitionTeamNames(id),
    listFixtures(id),
    listCompetitions().then((cs) => cs.filter((c) => c.league_id === competition.league_id)),
    listTeams().then((ts) => ts.filter((t) => t.competition_id === id)),
  ]);
  const now = clockNow().getTime();
  const upcoming = fixtures.filter((f) => new Date(f.kickoff).getTime() > now);
  const past = fixtures.filter((f) => new Date(f.kickoff).getTime() <= now).reverse();
  const when = (iso: string) => `${formatDay(new Date(iso))}, ${TIME.format(new Date(iso)).toLowerCase()}`;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
      <Link href="/account" className="text-sm text-zinc-500">
        ← My teams
      </Link>
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

      {isNew && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="font-semibold">🎉 {competition.name} is set up</div>
          <p className="mt-1">
            Next: add the teams and fixtures below (or import a CSV). Then teams can join it via <b>My teams → Create a
            team</b> and pick “{competition.league.name} · {competition.name}”.
          </p>
        </div>
      )}

      <Card title="Teams" aside={`${teams.length} in the draw · ${sidelnrTeams.length} on Sidelnr`}>
        <TeamsEditor competitionId={id} teams={teams} />
      </Card>

      <Card title="Import fixtures" aside="CSV / spreadsheet">
        <ImportCsvForm competitionId={id} />
      </Card>

      <Card title="Add a fixture">
        <AddFixtureForm competitionId={id} teams={teams} />
      </Card>

      <Card title="Results" aside={past.length ? "Enter scores after each game" : undefined}>
        {past.length === 0 ? (
          <p className="text-sm text-zinc-500">Played games appear here for you to enter scores.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {past.map((f) => (
              <ResultRow key={f.id} competitionId={id} fixture={f} when={when(f.kickoff)} />
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
              <ResultRow key={f.id} competitionId={id} fixture={f} when={when(f.kickoff)} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Competition settings">
        <CompetitionSettingsForm competitionId={id} initial={competition} />
      </Card>

      <Card title={`Add a competition to ${competition.league.short_name ?? competition.league.name}`}>
        <AddCompetitionForm leagueId={competition.league_id} />
      </Card>
    </div>
  );
}
