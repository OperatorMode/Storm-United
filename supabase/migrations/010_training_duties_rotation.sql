-- Coach tools: training sessions, duty roster and fair playing time.
-- Run once in the Supabase SQL editor. (The app copes until it's run: these
-- features just stay empty.)

-- Training sessions. Weekly training is stored as one row per session (same
-- series_id), so a single week can be moved or cancelled. Attendance answers
-- go in the existing attendance table (game_id = the session id).
create table if not exists training_sessions (
  id         text primary key,
  team_id    text not null references teams (id) on delete cascade,
  starts_at  timestamptz not null,
  minutes    integer not null default 60,
  location   text,
  note       text,
  cancelled  boolean not null default false,
  series_id  text,
  created_at timestamptz not null default now()
);
create index if not exists training_sessions_team_idx on training_sessions (team_id, starts_at);

-- Duty roster: the jobs a team needs filled each game (oranges, snacks…) and
-- who's doing them. player_id = the family (its first child).
create table if not exists team_duties (
  team_id text not null references teams (id) on delete cascade,
  name    text not null,
  sort    integer not null default 0,
  primary key (team_id, name)
);
create table if not exists duty_signups (
  team_id    text not null references teams (id) on delete cascade,
  game_id    text not null,
  duty       text not null,
  player_id  text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, game_id, duty)
);

-- Fair playing time: the coach's rotation for a game (who's on, who rests,
-- each period).
create table if not exists game_rotations (
  team_id    text not null references teams (id) on delete cascade,
  game_id    text not null,
  plan       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, game_id)
);

alter table training_sessions enable row level security;
alter table team_duties       enable row level security;
alter table duty_signups      enable row level security;
alter table game_rotations    enable row level security;
