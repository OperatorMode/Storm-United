-- Phase 1b: manager accounts (email login links). Additive; safe to run
-- before deploying. Team PINs keep working alongside accounts.

create table if not exists managers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,             -- stored lower-case
  name       text,
  created_at timestamptz not null default now()
);

-- Which manager accounts can run which teams (a team can have several).
create table if not exists team_managers (
  team_id    text not null references teams (id) on delete cascade,
  manager_id uuid not null references managers (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (team_id, manager_id)
);
create index if not exists team_managers_manager_idx on team_managers (manager_id);

-- One-time login links: only a hash of the token is stored; 15 min expiry.
create table if not exists login_tokens (
  token_hash text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_tokens_email_idx on login_tokens (email, created_at desc);

alter table managers      enable row level security;
alter table team_managers enable row level security;
alter table login_tokens  enable row level security;
