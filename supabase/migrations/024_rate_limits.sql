-- Wrong guesses (team PINs, join codes, the owner PIN, share codes): after 5
-- wrong tries in 15 minutes from one device, it's locked for 15 minutes.
-- key = kind:scope:device (a hash of the internet address, not the address).
create table if not exists rate_limits (
  key          text primary key,
  failures     integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
alter table rate_limits enable row level security;
