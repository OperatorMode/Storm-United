-- Housekeeping on the owner page: how big the database is (the free plan
-- allows 500 MB) and its largest tables. Only the server (service role) may
-- call it.
create or replace function sidelnr_usage()
returns json
language sql
security definer
set search_path = public, pg_catalog
as $$
  select json_build_object(
    'database_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select json_agg(t order by t.bytes desc)
      from (
        select relname as name, n_live_tup as rows, pg_total_relation_size(relid) as bytes
        from pg_stat_user_tables
        where schemaname = 'public'
        order by pg_total_relation_size(relid) desc
        limit 8
      ) t
    ), '[]'::json)
  );
$$;

revoke all on function sidelnr_usage() from public, anon, authenticated;
grant execute on function sidelnr_usage() to service_role;
