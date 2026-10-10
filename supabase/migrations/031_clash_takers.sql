-- Clash solver (My Activities): who in the family takes each child to a game,
-- training or activity ("Dad", "Mum", or the child on their own). Two things at
-- the same time stop being a clash once different people are taking them.
create table if not exists clash_takers (
  household_id uuid not null references households (id) on delete cascade,
  entry_key    text not null,  -- "<team>:<game or training id>", or "<activity id>-<start>"
  taker        text not null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, entry_key)
);
alter table clash_takers enable row level security;
