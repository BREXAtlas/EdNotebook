\set ON_ERROR_STOP on

begin;

do $$
declare
  v_anon_security_definer_count integer;
begin
  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in ('public','private')
      and relation.relkind in ('r','p')
      and not relation.relrowsecurity
  ) then
    raise exception 'An application table does not have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname in ('public','private')
      and relation.relkind in ('r','p')
      and relation.relrowsecurity
      and not exists (
        select 1 from pg_policy policy where policy.polrelid=relation.oid
      )
  ) then
    raise exception 'An RLS-enabled application table has no explicit policy';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    cross join lateral aclexplode(
      coalesce(procedure.proacl,acldefault('f',procedure.proowner))
    ) privilege
    where namespace.nspname='public'
      and procedure.prosecdef
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid='pg_proc'::regclass
          and dependency.objid=procedure.oid
          and dependency.refclassid='pg_extension'::regclass
          and dependency.deptype='e'
      )
      and privilege.grantee=0
      and privilege.privilege_type='EXECUTE'
  ) then
    raise exception 'A public SECURITY DEFINER function is executable by PUBLIC';
  end if;

  select count(*) into v_anon_security_definer_count
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.prosecdef
    and not exists (
      select 1
      from pg_depend dependency
      where dependency.classid='pg_proc'::regclass
        and dependency.objid=procedure.oid
        and dependency.refclassid='pg_extension'::regclass
        and dependency.deptype='e'
    )
    and has_function_privilege('anon',procedure.oid,'EXECUTE');

  if v_anon_security_definer_count<>1 or not has_function_privilege(
    'anon',
    'public.list_alex_morrison_catalog(text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'Anonymous SECURITY DEFINER access must be limited to the Morrison catalog projection';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prosecdef
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid='pg_proc'::regclass
          and dependency.objid=procedure.oid
          and dependency.refclassid='pg_extension'::regclass
          and dependency.deptype='e'
      )
      and has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      and not exists (
        select 1
        from unnest(coalesce(procedure.proconfig,'{}'::text[])) setting
        where setting like 'search_path=%'
      )
  ) then
    raise exception 'An authenticated SECURITY DEFINER RPC does not pin a fixed search path';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prosecdef
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid='pg_proc'::regclass
          and dependency.objid=procedure.oid
          and dependency.refclassid='pg_extension'::regclass
          and dependency.deptype='e'
      )
      and has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      and lower(pg_get_functiondef(procedure.oid)) !~ 'auth[.]uid[(][)]|auth[.]jwt[(][)]|request[.]jwt[.]claim'
  ) then
    raise exception 'An authenticated SECURITY DEFINER RPC does not bind to request identity';
  end if;

  if exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prosecdef
      and not exists (
        select 1
        from pg_depend dependency
        where dependency.classid='pg_proc'::regclass
          and dependency.objid=procedure.oid
          and dependency.refclassid='pg_extension'::regclass
          and dependency.deptype='e'
      )
      and has_function_privilege('authenticated',procedure.oid,'EXECUTE')
      and lower(pg_get_functiondef(procedure.oid)) ~ '\mexecute\M'
  ) then
    raise exception 'An authenticated SECURITY DEFINER RPC uses dynamic SQL and requires a dedicated review';
  end if;

  if has_table_privilege('anon','public.lti_launch_sessions','select,insert,update,delete')
     or has_table_privilege('authenticated','public.lti_launch_sessions','select,insert,update,delete')
     or has_table_privilege('anon','public.lti_launch_states','select,insert,update,delete')
     or has_table_privilege('authenticated','public.lti_launch_states','select,insert,update,delete')
     or has_table_privilege('anon','public.lti_service_endpoints','select,insert,update,delete')
     or has_table_privilege('authenticated','public.lti_service_endpoints','select,insert,update,delete') then
    raise exception 'Internal LTI state is still directly exposed to a browser database role';
  end if;

  if has_table_privilege(
       'anon',
       'private.publication_learning_author_versions',
       'select,insert,update,delete'
     )
     or has_table_privilege(
       'authenticated',
       'private.publication_learning_author_versions',
       'select,insert,update,delete'
     ) then
    raise exception 'The author-only EduBook answer layer is directly exposed to a browser database role';
  end if;
end;
$$;

select 'security advisor contract passed' as result;

rollback;
