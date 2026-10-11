-- My Event: what kind of event it is (sets the page's background) and an
-- optional dress code ("Casual", "Smart casual", "Formal" or the organiser's own words).
alter table teams add column if not exists event_type text check (event_type in ('party', 'birthday', 'dinner', 'other'));
alter table teams add column if not exists event_dress text;
