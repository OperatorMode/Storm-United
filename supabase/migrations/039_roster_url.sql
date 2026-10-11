-- A team's roster link (its club's squad or roster page), kept separate from
-- the league's fixtures and ladder links. Players are read from it on request.
alter table teams add column if not exists roster_url text;
