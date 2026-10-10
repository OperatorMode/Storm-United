-- A notification when someone else adds an activity this phone shares
-- (another phone in the same household).
alter table household_push add column if not exists notify_new boolean not null default true;
