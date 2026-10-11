-- My Event: a one-day event (a party, a team breakup, a gala day) set up like a
-- small team. The organiser(s) are its managers; each invited family is a guest
-- (a player row), who answers Going / Maybe / Can't with a headcount.
alter table teams add column if not exists kind text not null default 'team' check (kind in ('team', 'event'));
alter table teams add column if not exists event_starts_at timestamptz;
alter table teams add column if not exists event_ends_at timestamptz;
alter table teams add column if not exists event_place text;
alter table teams add column if not exists event_details text;
alter table teams add column if not exists event_host text;     -- "Hosted by …"
alter table teams add column if not exists rsvp_by date;        -- optional reply-by date

-- Guests invited by another guest wait for an organiser's OK.
alter table players add column if not exists pending boolean not null default false;
alter table players add column if not exists invited_by text;   -- 'org' or the inviting guest's id

create table if not exists event_rsvps (
  team_id    text not null references teams (id) on delete cascade,
  guest_id   text not null,
  status     text not null check (status in ('yes', 'maybe', 'no')),
  adults     int not null default 1 check (adults between 0 and 50),
  kids       int not null default 0 check (kids between 0 and 50),
  updated_at timestamptz not null default now(),
  primary key (team_id, guest_id)
);
alter table event_rsvps enable row level security;
