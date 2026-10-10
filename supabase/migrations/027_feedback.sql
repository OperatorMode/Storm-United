-- "Send feedback": ideas, bugs and anything else, straight to the owner page.
create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,          -- "idea", "bug", "other"
  message    text not null,
  email      text,                   -- only if they'd like a reply
  page       text,                   -- the page they were on
  device     text,                   -- "iPhone", "Android", "Computer"
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
