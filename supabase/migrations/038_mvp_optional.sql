-- MVP votes are optional per team (Team settings). On by default, so nothing changes for existing teams.
alter table teams add column if not exists mvp_enabled boolean not null default true;
