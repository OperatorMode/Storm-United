-- Storm United — run once in the Supabase SQL editor.
-- The app only talks to these tables server-side with the service-role key,
-- so RLS is enabled with no policies: the public anon key can't read or write.

create table if not exists attendance (
  game_id    text not null,
  player_id  text not null,
  status     text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

-- One 3-2-1 ballot per voter (family or coach) per game; re-voting overwrites.
create table if not exists ballots (
  game_id    text not null,
  voter_id   text not null,
  first      text not null,
  second     text not null,
  third      text not null,
  updated_at timestamptz not null default now(),
  primary key (game_id, voter_id),
  check (first <> second and first <> third and second <> third)
);

-- Fallback scores, only used when the league feed hasn't posted a result.
create table if not exists manual_scores (
  game_id text primary key,
  home    int not null check (home >= 0),
  away    int not null check (away >= 0)
);

alter table attendance    enable row level security;
alter table ballots       enable row level security;
alter table manual_scores enable row level security;

-- Goalie volunteer slot per player per game (added after launch).
alter table attendance add column if not exists goalie text
  check (goalie in ('1st', '2nd', 'full'));
