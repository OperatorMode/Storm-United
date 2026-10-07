-- Linked leagues show the ladder from the league's own website (ladder_url),
-- read into ladder_table; ladder_hash skips re-reading an unchanged page.
alter table competitions add column if not exists ladder_url text;
alter table competitions add column if not exists ladder_table jsonb;
alter table competitions add column if not exists ladder_hash text;
