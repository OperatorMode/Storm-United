-- When a linked league's ladder page was last read (whether or not it had
-- changed), so the after-game check schedule knows what's due.
alter table competitions add column if not exists ladder_checked_at timestamptz;
