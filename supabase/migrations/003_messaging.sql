-- Message board (coach announcements + family acknowledgements), team chat,
-- and web-push subscriptions. Additive only; safe to run before deploying.

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists announcements_team_idx on announcements (team_id, created_at desc);

-- One acknowledgement per family (player id) per announcement.
create table if not exists announcement_acks (
  announcement_id uuid not null references announcements (id) on delete cascade,
  player_id       text not null,
  created_at      timestamptz not null default now(),
  primary key (announcement_id, player_id)
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams (id) on delete cascade,
  author_id  text not null,             -- a player id (that family) or 'coach'
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_team_idx on chat_messages (team_id, created_at desc);

-- One row per phone/browser that turned notifications on.
create table if not exists push_subscriptions (
  endpoint     text not null,
  team_id      text not null references teams (id) on delete cascade,
  author_id    text,                    -- who this device posts as, so we don't notify them of their own messages
  p256dh       text not null,
  auth         text not null,
  notify_board boolean not null default true,
  notify_chat  boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (endpoint, team_id)
);
create index if not exists push_subscriptions_team_idx on push_subscriptions (team_id);

alter table announcements      enable row level security;
alter table announcement_acks  enable row level security;
alter table chat_messages      enable row level security;
alter table push_subscriptions enable row level security;
