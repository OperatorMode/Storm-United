-- A team's special role (goalie_enabled turns it on): its name, e.g. "Goalie",
-- "Catcher", "Bowler". Null means "Goalie".
alter table teams add column if not exists role_name text;
