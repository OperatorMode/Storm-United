-- Sharing chosen activities (not the whole household) with another phone: a
-- short-lived code for a set of activities, and the links it creates. Linked
-- activities stay one activity, so a cancelled session shows on both phones.
create table if not exists activity_shares (
  code_hash    text primary key,
  household_id uuid not null references households (id) on delete cascade,
  activity_ids uuid[] not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);
create table if not exists activity_links (
  household_id uuid not null references households (id) on delete cascade,
  activity_id  uuid not null references activities (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (household_id, activity_id)
);
alter table activity_shares enable row level security;
alter table activity_links enable row level security;
