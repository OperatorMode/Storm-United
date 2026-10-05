-- Leagues & fixtures by anyone: managers can create their own league and
-- competitions, add teams and fixtures (typed in or uploaded), and enter
-- results. Additive only; safe to run before deploying.

-- Who created a league, and its timezone (kick-off times are shown in it).
alter table leagues add column if not exists created_by uuid references managers (id) on delete set null;
alter table leagues add column if not exists timezone text not null default 'Australia/Perth';

-- League admins: can edit the league's competitions, fixtures and results.
create table if not exists league_admins (
  league_id  text not null references leagues (id) on delete cascade,
  manager_id uuid not null references managers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, manager_id)
);
create index if not exists league_admins_manager_idx on league_admins (manager_id);

-- Teams in a competition's draw (for leagues without a live feed).
create table if not exists competition_teams (
  competition_id text not null references competitions (id) on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now(),
  primary key (competition_id, name)
);

-- Fixtures and results (for leagues without a live feed).
create table if not exists fixtures (
  id             text primary key default gen_random_uuid()::text,
  competition_id text not null references competitions (id) on delete cascade,
  round          int,                          -- null for e.g. tournament games
  stage          text,                         -- e.g. 'Pool A', 'Semi-final' (tournaments)
  kickoff        timestamptz not null,
  pitch          text,
  home           text not null,
  away           text not null,
  home_score     int check (home_score >= 0),
  away_score     int check (away_score >= 0),
  status         text not null default 'scheduled'
                 check (status in ('scheduled', 'postponed', 'cancelled')),
  updated_at     timestamptz not null default now(),
  check (home <> away)
);
create index if not exists fixtures_competition_idx on fixtures (competition_id, kickoff);

alter table league_admins     enable row level security;
alter table competition_teams enable row level security;
alter table fixtures          enable row level security;
