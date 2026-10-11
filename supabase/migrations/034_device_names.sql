-- "Who are you?": the name a phone's user chooses once (e.g. "Tobi"), used
-- across the app: their answer to an event, and in each team next to who they
-- are to the player ("Tobi (Brooklyn's Dad)").
create table if not exists device_profiles (
  device_id  text primary key,
  name       text not null,
  updated_at timestamptz not null default now()
);
alter table device_profiles enable row level security;
