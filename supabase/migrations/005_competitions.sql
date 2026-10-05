-- Phase 1a: League → Competition hierarchy. Additive; safe to run before
-- deploying. TPP becomes the first league (fixtures from its live feed), with
-- one competition per division, and every existing team is linked to its
-- competition.

create table if not exists leagues (
  id         text primary key,                  -- slug, e.g. 'tpp-6aside-2026'
  name       text not null,                     -- 'TPP 6 A-Side League 2026'
  short_name text,                              -- 'TPP 6 A-Side' (shown in headers)
  website    text,                              -- credited as the source of the draw
  venue      text,                              -- e.g. 'Rossiter Pavilion, Piara Waters'
  source     text not null default 'manual'     -- where fixtures/results come from
             check (source in ('tpp', 'manual')),
  created_at timestamptz not null default now()
);

create table if not exists competitions (
  id                text primary key,           -- e.g. 'tpp-2026-u10'
  league_id         text not null references leagues (id) on delete cascade,
  name              text not null,              -- 'Under 10s'
  season            text,                       -- '2026'
  kind              text not null default 'season' check (kind in ('season', 'tournament')),
  source_key        text,                       -- id of this competition in the source (TPP division code)
  points_win        int  not null default 3,
  points_draw       int  not null default 1,
  ladder_last_round int,                        -- rounds after this are finals (not counted)
  finals_date       date,
  finals_note       text,
  created_at        timestamptz not null default now()
);

alter table teams add column if not exists competition_id text references competitions (id);

insert into leagues (id, name, short_name, website, venue, source) values
  ('tpp-6aside-2026', 'TPP 6 A-Side League 2026', 'TPP 6 A-Side', 'https://tpp-6aside.netlify.app/', 'Rossiter Pavilion, Piara Waters', 'tpp')
on conflict (id) do nothing;

insert into competitions (id, league_id, name, season, source_key, ladder_last_round, finals_date, finals_note) values
  ('tpp-2026-u8',  'tpp-6aside-2026', 'Under 8s',  '2026', 'U8',  9, '2026-12-14', 'Top two play the grand final in week 10.'),
  ('tpp-2026-u10', 'tpp-6aside-2026', 'Under 10s', '2026', 'U10', 9, '2026-12-14', 'Top two play the grand final in week 10.'),
  ('tpp-2026-u12', 'tpp-6aside-2026', 'Under 12s', '2026', 'U12', 9, '2026-12-14', 'Top two play the grand final in week 10.'),
  ('tpp-2026-u14', 'tpp-6aside-2026', 'Under 14s', '2026', 'U14', 9, '2026-12-14', 'Top two play the grand final in week 10.')
on conflict (id) do nothing;

update teams set competition_id = 'tpp-2026-' || lower(division) where competition_id is null;

alter table leagues      enable row level security;
alter table competitions enable row level security;
