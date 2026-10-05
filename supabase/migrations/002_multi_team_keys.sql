-- Multi-team, step 2 of 2. Run AFTER the multi-team code is deployed.
-- Swaps the old single-team keys for team-scoped ones, so two teams can
-- both track the same game (and both have, say, a player called "ryan").
-- Safe to re-run; the whole script runs as one transaction.

-- Make sure the team-scoped unique indexes exist (step 1 creates them, but
-- don't rely on it). They can't clash: every existing row is Storm United's.
create unique index if not exists attendance_team_key    on attendance    (team_id, game_id, player_id);
create unique index if not exists ballots_team_key       on ballots       (team_id, game_id, voter_id);
create unique index if not exists manual_scores_team_key on manual_scores (team_id, game_id);

alter table attendance drop constraint if exists attendance_pkey;
alter table attendance add constraint attendance_pkey primary key using index attendance_team_key;
alter table attendance alter column team_id drop default;

alter table ballots drop constraint if exists ballots_pkey;
alter table ballots add constraint ballots_pkey primary key using index ballots_team_key;
alter table ballots alter column team_id drop default;

alter table manual_scores drop constraint if exists manual_scores_pkey;
alter table manual_scores add constraint manual_scores_pkey primary key using index manual_scores_team_key;
alter table manual_scores alter column team_id drop default;
