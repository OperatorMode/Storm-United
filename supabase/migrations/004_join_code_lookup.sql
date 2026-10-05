-- Lets parents find their team from the landing page by typing the team's
-- join code. join_code_key is an unsalted hash of the (normalised) code so it
-- can be looked up; the unique index makes codes unique across teams.
alter table teams add column if not exists join_code_key text;
create unique index if not exists teams_join_code_key on teams (join_code_key) where join_code_key is not null;
