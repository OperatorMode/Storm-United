-- Which phones follow which children in a team (each phone's private id), so
-- managers can see "Sam: 2 phones" and take a child off a phone that shouldn't
-- have picked it (removed_children: that phone can't pick them again).
create table if not exists team_phones (
  team_id          text not null references teams (id) on delete cascade,
  device_id        text not null,
  children         text not null default '',   -- player ids, comma-separated
  is_self          boolean not null default false, -- a player's own phone ("I am…")
  device           text,                        -- "iPhone", "Android", "Computer"
  last_seen        timestamptz not null default now(),
  removed_children text not null default '',
  primary key (team_id, device_id)
);
alter table team_phones enable row level security;
