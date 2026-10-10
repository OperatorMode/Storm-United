-- Every phone in a team is one person: "Leo's Dad", "Sam (Leo's Friend)", or
-- the player themselves ("I am…", one phone per player). Chat and private
-- messages use the person (member_id) instead of the child, so two parents of
-- the same child are two different people.
alter table team_phones add column if not exists member_id uuid not null default gen_random_uuid();
alter table team_phones add column if not exists relation text;   -- "Dad", "Mum", "Friend", "Aunty"…
alter table team_phones add column if not exists name text;       -- optional, e.g. "Sam"
alter table team_phones add column if not exists created_at timestamptz not null default now();
create unique index if not exists team_phones_member_id on team_phones (member_id);

-- Which person a phone's notifications belong to (private messages to that person).
alter table push_subscriptions add column if not exists person_id text;
