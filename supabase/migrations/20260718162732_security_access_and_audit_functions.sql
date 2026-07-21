create or replace function private.is_institution_manager(p_institution_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_institution_id is not null and (
    exists (
      select 1 from public.institutions i
      where i.id=p_institution_id and i.owner_id=p_user_id
    )
    or exists (
      select 1 from public.institution_memberships im
      where im.institution_id=p_institution_id
        and im.user_id=p_user_id
        and im.role in ('owner','admin','security','records')
    )
    or exists (
      select 1 from public.profiles p
      where p.id=p_user_id and p.role in ('owner','admin')
    )
  );
$$;

create or replace function private.can_access_publication(p_publication_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.publications p
    where p.id=p_publication_id
      and (
        p.owner_id=p_user_id
        or (p.status='published' and p.access_model='open')
        or (p.course_id is not null and private.can_access_course(p.course_id))
        or exists (
          select 1 from public.publication_entitlements pe
          where pe.publication_id=p.id
            and pe.user_id=p_user_id
            and pe.active
            and pe.starts_at <= now()
            and (pe.expires_at is null or pe.expires_at > now())
        )
        or exists (
          select 1 from public.profiles pr
          where pr.id=p_user_id and pr.role in ('owner','admin')
        )
      )
  );
$$;

create or replace function private.can_access_secure_file(p_file_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.secure_file_objects f
    where f.id=p_file_id
      and f.availability_status <> 'deleted'
      and (
        f.owner_id=p_user_id
        or (f.course_id is not null and private.can_access_course(f.course_id))
        or (f.assignment_id is not null and private.can_manage_assignment(f.assignment_id))
        or (f.publication_id is not null and private.can_access_publication(f.publication_id,p_user_id))
        or (f.institution_id is not null and private.is_institution_manager(f.institution_id,p_user_id))
        or exists (
          select 1 from public.profiles p
          where p.id=p_user_id and p.role in ('owner','admin')
        )
      )
  );
$$;

create or replace function private.can_manage_secure_file(p_file_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.secure_file_objects f
    where f.id=p_file_id
      and f.availability_status <> 'deleted'
      and (
        f.owner_id=p_user_id
        or (f.course_id is not null and private.can_manage_course(f.course_id))
        or (f.assignment_id is not null and private.can_manage_assignment(f.assignment_id))
        or exists (
          select 1 from public.publications p
          where p.id=f.publication_id and p.owner_id=p_user_id
        )
        or (f.institution_id is not null and private.is_institution_manager(f.institution_id,p_user_id))
        or exists (
          select 1 from public.profiles p
          where p.id=p_user_id and p.role in ('owner','admin')
        )
      )
  );
$$;

create or replace function private.file_is_on_legal_hold(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.secure_file_objects f
    join public.legal_holds h
      on h.active
      and h.released_at is null
      and (
        (h.institution_id is not null and h.institution_id=f.institution_id)
        or (h.course_id is not null and h.course_id=f.course_id)
      )
    where f.id=p_file_id
  )
  or exists (
    select 1
    from public.legal_hold_files lhf
    join public.legal_holds h on h.id=lhf.legal_hold_id
    where lhf.secure_file_id=p_file_id
      and h.active
      and h.released_at is null
  );
$$;

create or replace function private.audit_event_hash()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  new.event_hash := encode(
    extensions.digest(
      coalesce(new.occurred_at::text,'') || '|' ||
      coalesce(new.actor_id::text,'') || '|' ||
      coalesce(new.event_type,'') || '|' ||
      coalesce(new.target_type,'') || '|' ||
      coalesce(new.target_id,'') || '|' ||
      coalesce(new.details::text,'{}'),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

revoke all on function private.is_institution_manager(uuid,uuid) from public;
revoke all on function private.can_access_publication(uuid,uuid) from public;
revoke all on function private.can_access_secure_file(uuid,uuid) from public;
revoke all on function private.can_manage_secure_file(uuid,uuid) from public;
revoke all on function private.file_is_on_legal_hold(uuid) from public;
revoke all on function private.audit_event_hash() from public;

drop trigger if exists audit_events_hash on public.audit_events;
create trigger audit_events_hash
before insert on public.audit_events
for each row execute function private.audit_event_hash();

create or replace function private.audit_resource_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  event_name text;
  row_id uuid;
  row_owner uuid;
  row_course uuid;
  row_assignment uuid;
  row_file uuid;
  old_values jsonb := '{}'::jsonb;
  new_values jsonb := '{}'::jsonb;
begin
  if tg_op='INSERT' then
    event_name := 'resource.created';
    row_id := new.id;
    row_owner := new.owner_id;
    row_course := new.course_id;
    row_assignment := new.assignment_id;
    row_file := new.secure_file_id;
    new_values := jsonb_build_object('title',new.title,'visibility',new.visibility,'placement',new.placement);
  elsif tg_op='DELETE' then
    event_name := 'resource.deleted';
    row_id := old.id;
    row_owner := old.owner_id;
    row_course := old.course_id;
    row_assignment := old.assignment_id;
    row_file := old.secure_file_id;
    old_values := jsonb_build_object('title',old.title,'visibility',old.visibility,'placement',old.placement);
  else
    row_id := new.id;
    row_owner := new.owner_id;
    row_course := new.course_id;
    row_assignment := new.assignment_id;
    row_file := new.secure_file_id;
    if old.title is distinct from new.title or old.safe_name is distinct from new.safe_name then
      event_name := 'resource.renamed';
    elsif old.visibility is distinct from new.visibility then
      event_name := 'resource.share_changed';
    elsif old.deleted_at is distinct from new.deleted_at then
      event_name := 'resource.deletion_state_changed';
    else
      return new;
    end if;
    old_values := jsonb_build_object('title',old.title,'safe_name',old.safe_name,'visibility',old.visibility,'deleted_at',old.deleted_at);
    new_values := jsonb_build_object('title',new.title,'safe_name',new.safe_name,'visibility',new.visibility,'deleted_at',new.deleted_at);
  end if;

  insert into public.audit_events (
    actor_id,course_id,assignment_id,secure_file_id,resource_id,
    event_type,target_type,target_id,details,event_hash
  ) values (
    coalesce(auth.uid(),row_owner),row_course,row_assignment,row_file,row_id,
    event_name,'learning_resource',row_id::text,
    jsonb_build_object('old',old_values,'new',new_values),''
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.audit_resource_change() from public;
drop trigger if exists learning_resources_audit on public.learning_resources;
create trigger learning_resources_audit
after insert or update or delete on public.learning_resources
for each row execute function private.audit_resource_change();
