-- League messages: a league admin writes to every Sidelnr team in the league
-- ("all": posted on each team's Board, marked with the league's name in
-- announcements.source) or to the team managers only.
alter table announcements add column if not exists source text;
create table if not exists league_messages (
  id             uuid primary key default gen_random_uuid(),
  league_id      text not null references leagues (id) on delete cascade,
  competition_id text,                 -- null: every competition in the league
  audience       text not null check (audience in ('all', 'managers')),
  body           text not null check (char_length(body) between 1 and 2000),
  teams          integer not null default 0, -- Sidelnr teams it reached
  created_at     timestamptz not null default now()
);
create index if not exists league_messages_league_idx on league_messages (league_id, created_at desc);
alter table league_messages enable row level security;
