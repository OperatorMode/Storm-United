import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Section } from "@/components/Section";
import { OfficialLadderTable } from "@/components/OfficialLadderTable";
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
import { FixtureWizard } from "../../leagues/FixtureWizard";
import { FixtureOptions } from "../../leagues/FixtureOptions";
import { UpdateNow } from "../../leagues/UpdateNow";
import { LeagueMessageForm } from "../../leagues/LeagueMessage";
import { listLeagueMessages } from "@/lib/league-messages";
import { currentManagerId, isSuperAdmin } from "@/lib/session";
import { adminLeagueIds, listCompetitionTeamNames, listFixtures } from "@/lib/fixtures";
import { competitionTz, formatDay, getCompetition, listCompetitions } from "@/lib/league";
import { formatTime } from "@/lib/time";
import { isPoolStage } from "@/lib/events";
import { listTeams } from "@/lib/store";
import { now as clockNow } from "@/lib/clock";

export const metadata: Metadata = { title: "Competition · Sidelnr", robots: { index: false } };

// Reading a whole season from a league's website can take a few minutes.
export const maxDuration = 300;


const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the league website";
  }
};

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
          {competition.league.name} gets its fixtures and results from its own website automatically, so there’s nothing to edit here.
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
  const feed =
    competition.feed_type && competition.feed_url
      ? {
          type: competition.feed_type,
          url: competition.feed_url,
          filter: competition.feed_filter ?? null,
          team: competition.feed_team ?? null,
          syncedAt: competition.feed_synced_at ?? null,
          error: competition.feed_error ?? null,
        }
      : null;
  const event = competition.kind === "tournament";
  const poolGames = fixtures.filter((f) => isPoolStage(f.stage)).length;
  // Event finals games can have their teams filled in later.
  const teamsFor = (f: { stage: string | null }) => (event && !isPoolStage(f.stage) ? teams : undefined);
  const when = (iso: string) => `${formatDay(new Date(iso), tz)}, ${formatTime(new Date(iso), tz)}`;

  // League announcements to the Sidelnr teams in the league (all teams, or managers only).
  const sent = await listLeagueMessages(competition.league_id, 5);
  const messageCard = (
    <Card title="League announcement" aside={`${leagueImpact.sidelnrTeams.length} team${leagueImpact.sidelnrTeams.length === 1 ? "" : "s"} on Sidelnr`}>
      <LeagueMessageForm
        competitionId={id}
        competitionName={competition.name}
        teamsHere={sidelnrTeams.length}
        teamsInLeague={leagueImpact.sidelnrTeams.length}
        severalCompetitions={siblings.length > 1}
      />
      {sent.length > 0 && (
        <details className="mt-4 border-t border-zinc-100 pt-3 text-sm">
          <summary className="cursor-pointer text-zinc-600">Sent announcements ({sent.length})</summary>
          <ul className="mt-2 space-y-3">
            {sent.map((m) => (
              <li key={m.id}>
                <div className="text-xs text-zinc-500">
                  {when(m.created_at)} · {m.audience === "all" ? "All teams" : "Team managers"} · {m.teams} team{m.teams === 1 ? "" : "s"}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );

  // Pulled from a link (an official league, a linked sheet): everything comes
  // from the source and updates on its own, so there's nothing to edit here.
  if (feed) {
    const source = hostOf(feed.url);
    const game = (f: (typeof fixtures)[number]) => (
      <li key={f.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="block text-xs text-zinc-500">
            {f.round ? `Rd ${f.round} · ` : ""}
            {when(f.kickoff)}
          </span>
          {f.home} v {f.away}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">
          {f.status !== "scheduled" ? f.status : f.home_score !== null && f.away_score !== null ? `${f.home_score}–${f.away_score}` : ""}
        </span>
      </li>
    );
    return (
      <div className="mx-auto max-w-md space-y-4 p-4 pb-10">
        <div className="text-sm text-zinc-500">
          <Link href="/account/leagues">← My leagues</Link>
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

        {isNew && fixtures.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">
            <div className="text-xl font-bold">Almost there</div>
            <p className="mt-1">
              {competition.name} is set up and linked to {source}, but no games came through on the first read. Big
              schedules sometimes take a second try: press <b>Check for updates now</b> below.
            </p>
          </div>
        ) : isNew ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-sm text-emerald-900">
            <div className="text-2xl font-bold">All done</div>
            <p className="mt-1">
              {fixtures.length} games and {teams.length} teams loaded from {source}. They update automatically, so there’s
              nothing else to set up.
            </p>
            <div className="mt-4 space-y-2">
              <Link
                href={`/account/new?competition=${encodeURIComponent(id)}`}
                className="block rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white"
              >
                Create My Team
              </Link>
              <Link href="/" className="block rounded-xl border border-emerald-300 bg-white px-4 py-3 font-semibold text-emerald-900">
                Back Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">Live from the league website</div>
            <p className="mt-1">
              Teams, fixtures and results come straight from {source} and update automatically, so there’s nothing to set up.
              Teams join it via <b>My Team → Create a team</b> and pick “{competition.league.short_name ?? competition.league.name} ·{" "}
              {competition.name}”.
            </p>
          </div>
        )}

        {messageCard}

        <Card title="Source" aside={source}>
          <div className="space-y-3 text-sm">
            <p className="text-zinc-600">
              {feed.error ? (
                <span className="text-accent">Last check failed: {feed.error}</span>
              ) : feed.syncedAt ? (
                `Last updated ${when(feed.syncedAt)}.`
              ) : (
                "Not updated yet."
              )}{" "}
              Changes to games and results are made on the league’s website.
            </p>
            <a href={feed.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-zinc-500 underline">
              {feed.url}
            </a>
            <UpdateNow competitionId={id} />
          </div>
        </Card>

        <Section title="Ladder" aside={competition.ladder_table?.rows?.length ? `from ${competition.ladder_table.source}` : "not found yet"}>
          {competition.ladder_table?.rows?.length ? (
            <OfficialLadderTable ladder={competition.ladder_table} us="" ourName="" tz={tz} />
          ) : (
            <p className="text-sm text-zinc-500">
              {competition.ladder_url
                ? "The ladder is read from the league’s website at the next update."
                : "No ladder page found on the league’s website. Teams see a ladder worked out from the results instead."}
            </p>
          )}
        </Section>

        <Section title="Teams" aside={`${teams.length} in the draw · ${sidelnrTeams.length} on Sidelnr`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {teams.map((t) => (
              <li key={t} className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">
                {t}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Upcoming fixtures" aside={`${upcoming.length} games`}>
          {upcoming.length ? (
            <ul className="divide-y divide-zinc-100">{upcoming.map(game)}</ul>
          ) : (
            <p className="text-sm text-zinc-500">No upcoming games.</p>
          )}
        </Section>

        <Section title="Results" aside={`${past.length} played`}>
          {past.length ? <ul className="divide-y divide-zinc-100">{past.map(game)}</ul> : <p className="text-sm text-zinc-500">No games played yet.</p>}
        </Section>

        <Section title="Timezone" aside={tz.replaceAll("_", " ")}>
          <LeagueTimezoneForm competitionId={id} initial={tz} />
        </Section>

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
            day; results update live. Teams on Sidelnr can pick “{competition.league.name} · {competition.name}” as their
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

      {messageCard}

      <Card title="Teams" aside={`${teams.length} in the draw · ${sidelnrTeams.length} on Sidelnr`}>
        <TeamsEditor competitionId={id} teams={teams} />
      </Card>

      <FixtureOptions
        defaultOpen={fixtures.length === 0}
        aside={fixtures.length ? `${fixtures.length} games` : "None yet"}
        options={[
          ...(event
            ? []
            : [
                {
                  key: "auto",
                  title: "Create automatically",
                  hint: "Answer a few questions and Sidelnr builds the whole season",
                  content: <FixtureWizard competitionId={id} teams={teams} venue={competition.league.venue ?? ""} existing={upcoming.length} />,
                },
                {
                  key: "link",
                  title: "From a link",
                  hint: feed ? "Connected · updates automatically" : "Google Sheet, CSV, calendar or a website",
                  content: <FeedPanel competitionId={id} aiEnabled={!!process.env.ANTHROPIC_API_KEY} tz={tz} connected={feed} />,
                },
              ]),
          {
            key: "file",
            title: "From a file",
            hint: "Upload or paste a CSV / spreadsheet",
            content: <ImportCsvForm competitionId={id} />,
          },
          {
            key: "manual",
            title: event ? "Add a finals game" : "Add manually",
            hint: event ? "Semi-finals, final, placeholders like “1st Pool A”" : "One game at a time",
            content: (
              <AddFixtureForm
                competitionId={id}
                teams={teams}
                event={event}
                defaultDate={event && competition.season && /^\d{4}-\d{2}-\d{2}$/.test(competition.season) ? competition.season : undefined}
              />
            ),
          },
        ]}
      />

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
