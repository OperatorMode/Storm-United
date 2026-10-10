-- Reporting a team chat message to the team's managers (like private
-- messages): they see it in Manager's Corner and can remove it or keep it.
create table if not exists chat_reports (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams (id) on delete cascade,
  message_id uuid not null references chat_messages (id) on delete cascade,
  reporter   text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table chat_reports enable row level security;
