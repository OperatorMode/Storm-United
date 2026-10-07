-- How a competition's ladder ranks teams: 'points' (win/draw/loss points,
-- e.g. football) or 'wins' (wins and losses, e.g. basketball).
alter table competitions add column if not exists ladder_style text not null default 'points'
  check (ladder_style in ('points', 'wins'));
