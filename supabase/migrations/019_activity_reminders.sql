-- Reminders for family activities (My Activities): the phones that want them,
-- with a switch each for "a day before" and "an hour before", and a log so
-- each reminder goes out once.
create table if not exists household_push (
  endpoint     text primary key,
  household_id uuid not null references households (id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  remind_day   boolean not null default true,
  remind_hour  boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists household_push_household_idx on household_push (household_id);
create table if not exists activity_reminder_log (
  household_id uuid not null references households (id) on delete cascade,
  key          text not null,
  sent_at      timestamptz not null default now(),
  primary key (household_id, key)
);
alter table household_push enable row level security;
alter table activity_reminder_log enable row level security;
