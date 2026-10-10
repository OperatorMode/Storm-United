-- Families own their child's access: the first phone to pick a child is in;
-- any later phone picking the same child waits ("pending") until a phone that
-- already follows that child approves it (the coach can too, as a fallback).
-- Phones already following children keep them (pending starts empty).
alter table team_phones add column if not exists pending text not null default ''; -- player ids, comma-separated
