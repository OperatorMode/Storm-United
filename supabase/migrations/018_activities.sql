-- My Activities: a family's own activities (music, dance, school, any sport not
-- on Sidelnr) next to their team games. Parents have no account, so a phone
-- belongs to a household (a cookie holds its id); a short-lived share code
-- links another phone to the same household.
create table if not exists households (
  id               uuid primary key default gen_random_uuid(),
  share_code_hash  text,
  share_expires_at timestamptz,
  created_at       timestamptz not null default now()
);
create table if not exists activities (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households (id) on delete cascade,
  person        text not null check (char_length(person) between 1 and 40), -- first name, or "Me"
  name          text not null check (char_length(name) between 1 and 60),   -- "Piano", "Ballet"
  kind          text,                       -- Sport, Music, Dance, School, Other
  location      text,
  tz            text not null default 'Australia/Perth',
  weekly        jsonb not null default '[]', -- [{ d: 0-6 (Sun-Sat), t: "16:30", m: 60 }]
  starts_on     date,
  ends_on       date,
  extra         jsonb not null default '[]', -- one-off or imported: [{ at: ISO, m: 60, n?: title, l?: place }]
  cancelled     jsonb not null default '[]', -- ISO start times of cancelled sessions
  source_url    text,                        -- imported from a calendar or web page
  source_kind   text check (source_kind is null or source_kind in ('ics', 'web')),
  source_filter text,                        -- only sessions whose title contains this
  synced_at     timestamptz,
  source_error  text,
  created_at    timestamptz not null default now()
);
create index if not exists activities_household_idx on activities (household_id);
alter table households enable row level security;
alter table activities enable row level security;
