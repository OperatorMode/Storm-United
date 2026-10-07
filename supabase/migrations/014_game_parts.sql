-- How a team's games are split (2 halves, 4 quarters, 9 innings...), and a
-- special-role sign-up that can cover any of those parts: "full", or the part
-- numbers, e.g. "1,4,7". The old "1st"/"2nd" values still mean parts 1 and 2.
alter table teams add column if not exists game_parts integer not null default 2 check (game_parts between 1 and 12);
alter table teams add column if not exists part_name text not null default 'Half';
alter table attendance drop constraint if exists attendance_goalie_check;
alter table attendance add constraint attendance_goalie_check
  check (goalie is null or goalie ~ '^(full|1st|2nd|[0-9]{1,2}(,[0-9]{1,2})*)$');
