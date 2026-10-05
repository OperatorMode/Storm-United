-- Multi-team, step 1 of 2. Purely additive: the currently deployed
-- single-team app keeps working after this runs. Run it, deploy the
-- multi-team code, then run 002_multi_team_keys.sql.

create table if not exists teams (
  id             text primary key,              -- URL slug, e.g. 'storm-united'
  name           text not null,                 -- display name
  league_name    text not null,                 -- exact team name in the TPP draw
  division       text not null,                 -- 'U8' | 'U10' | 'U12' | 'U14'
  primary_color  text not null default '#0a0a0a',
  accent_color   text not null default '#e5334b',
  logo_url       text,                          -- null = generated crest
  admin_pin_hash text,                          -- scrypt "salt:hash"; null = super admin only
  join_code_hash text,                          -- null = no join code needed
  meet_minutes   int not null default 30,       -- meet this long before kick-off (0 = hide)
  goalie_enabled boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists players (
  team_id text not null references teams (id) on delete cascade,
  id      text not null,                        -- stable slug, referenced by attendance/ballots
  name    text not null,                        -- first name + last initial
  sort    int not null default 0,
  active  boolean not null default true,        -- removed players are kept for history
  primary key (team_id, id)
);

insert into teams (id, name, league_name, division, logo_url)
values ('storm-united', 'Storm United', 'Storm United', 'U10', '/brand/crest.svg')
on conflict (id) do nothing;

insert into players (team_id, id, name, sort) values
  ('storm-united', 'benjamin',  'Benjamin B.',  0),
  ('storm-united', 'brooklyn',  'Brooklyn L.',  1),
  ('storm-united', 'erik',      'Erik J.',      2),
  ('storm-united', 'khushmeet', 'Khushmeet G.', 3),
  ('storm-united', 'rayygan',   'Rayygan K.',   4),
  ('storm-united', 'ryan',      'Ryan L.',      5),
  ('storm-united', 'viaan',     'Viaan V.',     6),
  ('storm-united', 'zane',      'Zane B.',      7)
on conflict do nothing;

-- Existing rows all belong to Storm United.
alter table attendance    add column if not exists team_id text not null default 'storm-united' references teams (id) on delete cascade;
alter table ballots       add column if not exists team_id text not null default 'storm-united' references teams (id) on delete cascade;
alter table manual_scores add column if not exists team_id text not null default 'storm-united' references teams (id) on delete cascade;

-- The new code upserts on these; they become the primary keys in step 2.
create unique index if not exists attendance_team_key    on attendance    (team_id, game_id, player_id);
create unique index if not exists ballots_team_key       on ballots       (team_id, game_id, voter_id);
create unique index if not exists manual_scores_team_key on manual_scores (team_id, game_id);

alter table teams   enable row level security;
alter table players enable row level security;

-- Public bucket for uploaded team logos (written server-side only).
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;
