-- My Event: the event's own time zone (shown times are in it).
alter table teams add column if not exists event_tz text;
