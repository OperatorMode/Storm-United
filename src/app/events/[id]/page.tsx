import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/Card";
import { AutoRefresh } from "./AutoRefresh";
import { competitionTz, listCompetitions, poolTables } from "@/lib/league";
import { listFixtures } from "@/lib/fixtures";
import { isPoolStage } from "@/lib/events";
import { formatIsoDate, formatTime } from "@/lib/time";
import type { FixtureRow } from "@/lib/store";

// The public game-day page for an event: the draw by time and pitch, live
// results, pool tables and finals. No sign-in — share the link on the day.

async function eventDivisions(id: string) {
  const divisions = (await listCompetitions()).filter((c) => c.league_id === id);
  return divisions.length && divisions.every((c) => c.kind === "tournament") ? divisions : null;
}

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const divisions = await eventDivisions((await params).id);
  return { title: divisions ? `${divisions[0].league.name} · Sidelnr` : "Event · Sidelnr" };
}

const scoreOf = (f: FixtureRow) =>
  f.home_score !== null && f.away_score !== null ? { home: f.home_score, away: f.away_score } : null;

export default async function EventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const divisions = await eventDivisions(id);
  if (!divisions) notFound();
  const division = divisions.find((d) => d.id === query.d) ?? divisions[0];
  const league = division.league;
  const tz = competitionTz(division);
  const team = typeof query.team === "string" && query.team ? query.team : null;

  const fixtures = (await listFixtures(division.id))
    .filter((f) => f.status !== "cancelled")
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || (a.pitch ?? "").localeCompare(b.pitch ?? "", undefined, { numeric: true }));
  const teams = [...new Set(fixtures.filter((f) => isPoolStage(f.stage)).flatMap((f) => [f.home, f.away]))].sort();
  const shown = team ? fixtures.filter((f) => f.home === team || f.away === team) : fixtures;
  const tables = poolTables(
    fixtures.map((f) => ({ stage: f.stage, home: f.home, away: f.away, round: f.round, score: scoreOf(f) })),
    { win: division.points_win, draw: division.points_draw },
  );
  const finals = fixtures.filter((f) => !isPoolStage(f.stage));

  // The draw grouped by kick-off time.
  const slots = new Map<string, FixtureRow[]>();
  for (const f of shown) slots.set(f.kickoff, [...(slots.get(f.kickoff) ?? []), f]);
  const date = division.season && /^\d{4}-\d{2}-\d{2}$/.test(division.season) ? division.season : null;
  const href = (d: string, t: string | null = null) => `/events/${id}?d=${encodeURIComponent(d)}${t ? `&team=${encodeURIComponent(t)}` : ""}`;

  return (
    <div className="mx-auto max-w-md pb-10">
      <AutoRefresh seconds={30} />
      <header className="jersey px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <Link href="/" className="text-xs font-semibold tracking-tight opacity-60">
          Sidelnr<span className="text-accent">.</span>
        </Link>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">{league.name}</h1>
        <p className="mt-1 text-sm opacity-70">
          {[date && formatIsoDate(date, tz), league.venue].filter(Boolean).join(" · ")}
        </p>
        {divisions.length > 1 && (
          <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
            {divisions.map((d) => (
              <Link
                key={d.id}
                href={href(d.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${d.id === division.id ? "bg-accent font-semibold text-on-accent" : "bg-white/10"}`}
              >
                {d.name}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="mt-4 space-y-4 px-4">
        {fixtures.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            The draw for {division.name} isn’t out yet.
          </p>
        )}

        {teams.length > 0 && (
          <form action={`/events/${id}`} className="flex gap-2">
            <input type="hidden" name="d" value={division.id} />
            <select name="team" defaultValue={team ?? ""} className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm">
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Show</button>
          </form>
        )}

        {shown.length > 0 && (
          <Card title={team ? `${team}’s games` : "Draw"} aside={team ? <Link href={href(division.id)}>Show all</Link> : `${shown.length} games`}>
            <div className="space-y-4">
              {[...slots.entries()].map(([kickoff, games]) => (
                <div key={kickoff}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{formatTime(new Date(kickoff), tz)}</div>
                  <ul className="divide-y divide-zinc-100">
                    {games.map((f) => (
                      <GameRow key={f.id} f={f} team={team} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tables.map((t) => (
          <Card key={t.stage} title={t.stage}>
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="w-6 py-1.5 font-medium">#</th>
                  <th className="py-1.5 font-medium">Team</th>
                  <th className="py-1.5 text-center font-medium">P</th>
                  <th className="py-1.5 text-center font-medium">W</th>
                  <th className="py-1.5 text-center font-medium">D</th>
                  <th className="py-1.5 text-center font-medium">L</th>
                  <th className="py-1.5 text-center font-medium">GD</th>
                  <th className="py-1.5 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={r.team} className={`border-t border-zinc-100 ${r.team === team ? "bg-zinc-100 font-semibold" : ""}`}>
                    <td className="py-2">{i + 1}</td>
                    <td className="max-w-40 truncate py-2">{r.team}</td>
                    <td className="py-2 text-center">{r.p}</td>
                    <td className="py-2 text-center">{r.w}</td>
                    <td className="py-2 text-center">{r.d}</td>
                    <td className="py-2 text-center">{r.l}</td>
                    <td className="py-2 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="py-2 text-right">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">
              {division.points_win} pts a win, {division.points_draw} a draw.
            </p>
          </Card>
        ))}

        {finals.length > 0 && !team && (
          <Card title="Finals">
            <ul className="divide-y divide-zinc-100">
              {finals.map((f) => (
                <GameRow key={f.id} f={f} team={null} when={formatTime(new Date(f.kickoff), tz)} />
              ))}
            </ul>
          </Card>
        )}

        <p className="pt-2 text-center text-xs text-zinc-400">Results update automatically · Sidelnr</p>
      </main>
    </div>
  );
}

function GameRow({ f, team, when }: { f: FixtureRow; team: string | null; when?: string }) {
  const score = scoreOf(f);
  const meta = [when, f.stage, f.pitch && `Pitch ${f.pitch}`, f.status === "postponed" && "Postponed"].filter(Boolean).join(" · ");
  const name = (t: string) => <span className={t === team ? "font-semibold" : ""}>{t}</span>;
  return (
    <li className="py-2 text-sm">
      <div className="text-xs text-zinc-500">{meta}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-right">{name(f.home)}</span>
        <span className={`w-14 shrink-0 rounded-md py-0.5 text-center tabular-nums ${score ? "bg-zinc-900 font-semibold text-white" : "bg-zinc-100 text-zinc-400"}`}>
          {score ? `${score.home} – ${score.away}` : "v"}
        </span>
        <span className="min-w-0 flex-1 truncate">{name(f.away)}</span>
      </div>
    </li>
  );
}
