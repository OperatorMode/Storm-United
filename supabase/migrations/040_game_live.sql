-- My Game: the coach's sideline screen. One row per game in progress: who's
-- on the field and where, the clock and the scorers (state, as JSON). Families
-- see the live score next to the team on their home screen.
create table if not exists game_live (
  team_id    text not null references teams (id) on delete cascade,
  game_id    text not null,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (team_id, game_id)
);
alter table game_live enable row level security;

-- Where each player usually plays on the field (player id -> x, y), for next game.
alter table teams add column if not exists field_layout jsonb;
