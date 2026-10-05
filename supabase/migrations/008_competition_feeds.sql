-- Fixtures from a link: a competition can pull its fixtures/results from a
-- CSV or Google Sheet link, a calendar (ICS) link, or any web page (read by
-- AI). Synced into the fixtures table. Additive; safe to run before deploying.

alter table competitions add column if not exists feed_type text check (feed_type in ('csv', 'ics', 'web'));
alter table competitions add column if not exists feed_url text;
alter table competitions add column if not exists feed_filter text;      -- web: which division/competition on the page
alter table competitions add column if not exists feed_team text;        -- ics: the team whose calendar it is
alter table competitions add column if not exists feed_synced_at timestamptz;
alter table competitions add column if not exists feed_error text;
alter table competitions add column if not exists feed_hash text;        -- web: page fingerprint, so AI only runs on changes
