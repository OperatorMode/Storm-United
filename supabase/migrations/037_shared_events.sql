-- My Activities: "Share an event" (not the whole family). A share can be one
-- date of a series (only_at) or every time (null). The family it's shared
-- with can leave single dates for themselves (left_at) without changing the
-- original, and is shown by name (their "Who are you?") so the owner's family
-- can pick them in "Who's taking".
alter table activity_shares add column if not exists only_at text[];
alter table activity_links add column if not exists only_at text[];
alter table activity_links add column if not exists left_at text[] not null default '{}';
alter table activity_links add column if not exists name text;
