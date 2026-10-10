-- Who created an activity (a phone's private id, from a cookie), so only that
-- phone can delete it for everyone it's shared with. Anyone else removing it
-- only hides it on their own phone (activity_hidden), which also stops that
-- phone's reminders and calendar entries for it (household_push.device_id).
alter table activities add column if not exists created_by_device text;
alter table household_push add column if not exists device_id text;
create table if not exists activity_hidden (
  device_id   text not null,
  activity_id uuid not null references activities (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (device_id, activity_id)
);
alter table activity_hidden enable row level security;
