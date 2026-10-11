-- My Event: who from the family is going (first names, as in My Activities),
-- so each person gets their own dot on the family's calendar.
alter table event_rsvps add column if not exists people text[] not null default '{}';
