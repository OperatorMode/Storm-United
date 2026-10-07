-- Official (verified) leagues. Anyone can create or import a league, but only
-- a verified one can send league announcements. Verified by a one-time code
-- emailed to an address on the league's own domain, or by a Sidelnr review.
alter table leagues add column if not exists verified_at timestamptz;
alter table leagues add column if not exists verified_by text; -- the official email, or "review"
-- A team can turn off announcements from its league.
alter table teams add column if not exists mute_league boolean not null default false;
create table if not exists league_claims (
  id          uuid primary key default gen_random_uuid(),
  league_id   text not null references leagues (id) on delete cascade,
  manager_id  text not null,
  kind        text not null check (kind in ('email', 'review')),
  email       text,                    -- email claims: the official address
  code_hash   text,                    -- email claims: sha256 of the 6-digit code
  attempts    integer not null default 0,
  expires_at  timestamptz,
  note        text check (note is null or char_length(note) <= 1000), -- review claims
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'used', 'expired')),
  created_at  timestamptz not null default now()
);
create index if not exists league_claims_league_idx on league_claims (league_id, created_at desc);
alter table league_claims enable row level security;
