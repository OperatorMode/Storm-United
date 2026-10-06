-- Game alerts: time/pitch changes, postponements, "can your child play?"
-- reminders and match-day reminders. Run once in the Supabase SQL editor.

-- Each phone chooses which alerts it wants; existing subscribers get the new
-- ones switched on. `children` = the player ids this phone picked (for
-- personal reminders).
alter table push_subscriptions add column if not exists notify_games     boolean not null default true;
alter table push_subscriptions add column if not exists notify_reminders boolean not null default true;
alter table push_subscriptions add column if not exists children         text;

-- What each team's upcoming games looked like at the last check, to spot changes.
create table if not exists team_game_state (
  team_id    text primary key references teams (id) on delete cascade,
  games      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Reminders already sent (so each goes out once).
create table if not exists notification_log (
  team_id text not null references teams (id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (team_id, key)
);

alter table team_game_state  enable row level security;
alter table notification_log enable row level security;
