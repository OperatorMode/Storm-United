-- Private messages between families in a team (parents only; not players'
-- own phones): one-to-one or small groups. Members are players' ids (a phone
-- belongs to the children it picked) or "coach". Anyone can leave a group;
-- families can block each other and report a message to the team's managers.
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  team_id         text not null references teams (id) on delete cascade,
  name            text check (name is null or char_length(name) <= 60), -- groups
  is_group        boolean not null default false,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists conversations_team_idx on conversations (team_id, last_message_at desc);
create table if not exists conversation_members (
  conversation_id uuid not null references conversations (id) on delete cascade,
  member          text not null,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  last_read_at    timestamptz,
  primary key (conversation_id, member)
);
create table if not exists direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  author          text not null,
  body            text not null check (char_length(body) between 1 and 2000),
  kind            text not null default 'text' check (kind in ('text', 'system')), -- system: "Sam's parent left"
  removed         boolean not null default false, -- removed by a manager after a report
  created_at      timestamptz not null default now()
);
create index if not exists direct_messages_conv_idx on direct_messages (conversation_id, created_at);
create table if not exists dm_blocks (
  team_id    text not null references teams (id) on delete cascade,
  blocker    text not null,
  blocked    text not null,
  created_at timestamptz not null default now(),
  primary key (team_id, blocker, blocked)
);
create table if not exists dm_reports (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams (id) on delete cascade,
  message_id uuid not null references direct_messages (id) on delete cascade,
  reporter   text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
-- Phones choose whether they get a notification for private messages.
alter table push_subscriptions add column if not exists notify_dm boolean not null default true;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table direct_messages enable row level security;
alter table dm_blocks enable row level security;
alter table dm_reports enable row level security;
