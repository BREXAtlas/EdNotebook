-- Add only existing core course tables to the existing Supabase Realtime
-- publication. This migration is intentionally forward-only and idempotent:
-- it does not create, replace, or drop the managed publication.

do $$
declare
  v_table_name text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise notice 'supabase_realtime publication is unavailable; core course tables were not changed';
    return;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
      and puballtables
  ) then
    raise notice 'supabase_realtime already includes all tables; core course tables were not changed';
    return;
  end if;

  foreach v_table_name in array array[
    'courses',
    'assignments',
    'student_posts',
    'professor_announcements',
    'learning_messages'
  ]
  loop
    if to_regclass(format('public.%I', v_table_name)) is not null
       and not exists (
         select 1
         from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = v_table_name
       ) then
      execute format(
        'alter publication %I add table %I.%I',
        'supabase_realtime',
        'public',
        v_table_name
      );
    end if;
  end loop;
end;
$$;
