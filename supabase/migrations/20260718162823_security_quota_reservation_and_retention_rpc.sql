create or replace function private.effective_retention_days(
  p_owner_id uuid,
  p_institution_id uuid,
  p_course_id uuid,
  p_purpose text
)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  with matched as (
    select rp.retention_days
    from public.retention_policies rp
    where rp.active
      and (
        (p_course_id is not null and rp.course_id=p_course_id)
        or (p_institution_id is not null and rp.institution_id=p_institution_id)
      )
      and (cardinality(rp.resource_types)=0 or p_purpose=any(rp.resource_types))
  ), fallback as (
    select coalesce(
      (select max(retention_days) from matched),
      (select i.default_retention_days from public.institutions i where i.id=p_institution_id),
      (
        select spl.default_retention_days
        from public.profiles p
        join public.storage_plan_limits spl on spl.plan_key=p.plan_key and spl.active
        where p.id=p_owner_id
      ),
      30
    ) as days
  )
  select days from fallback;
$$;

revoke all on function private.effective_retention_days(uuid,uuid,uuid,text) from public;

create or replace function public.reserve_secure_upload(
  p_purpose text,
  p_original_name text,
  p_safe_name text,
  p_claimed_mime_type text,
  p_size_bytes bigint,
  p_course_id uuid default null,
  p_assignment_id uuid default null,
  p_publication_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  secure_file_id uuid,
  quarantine_bucket text,
  quarantine_path text,
  destination_bucket text,
  destination_path text,
  plan_key text,
  quota_bytes bigint,
  max_file_bytes bigint,
  used_bytes bigint,
  reserved_bytes bigint,
  retention_until timestamptz,
  upload_expires_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_file_id uuid := gen_random_uuid();
  v_plan_key text;
  v_quota bigint;
  v_max_file bigint;
  v_used bigint;
  v_reserved bigint;
  v_institution_id uuid;
  v_retention_days integer;
  v_destination_bucket text;
  v_destination_path text;
  v_quarantine_path text;
  v_retention_until timestamptz;
  v_upload_expires_at timestamptz := now() + interval '24 hours';
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'File size must be greater than zero'; end if;
  if p_safe_name is null or char_length(p_safe_name) < 1 or char_length(p_safe_name) > 255 or p_safe_name !~ '^[A-Za-z0-9][A-Za-z0-9._-]*$' then
    raise exception 'Safe filename is invalid';
  end if;
  if p_purpose not in ('private','course','submission','publication') then
    raise exception 'Upload purpose is invalid';
  end if;

  select coalesce(nullif(p.plan_key,''),'free')
  into v_plan_key
  from public.profiles p
  where p.id=v_user_id;

  select spl.quota_bytes,spl.max_file_bytes
  into v_quota,v_max_file
  from public.storage_plan_limits spl
  where spl.plan_key=v_plan_key and spl.active;

  if v_quota is null then
    v_plan_key := 'free';
    select spl.quota_bytes,spl.max_file_bytes into v_quota,v_max_file
    from public.storage_plan_limits spl where spl.plan_key='free';
  end if;

  if p_size_bytes > v_max_file then
    raise exception 'File exceeds the plan limit of % bytes',v_max_file;
  end if;

  if p_purpose='course' then
    if p_course_id is null or not private.can_manage_course(p_course_id) then
      raise exception 'Course management permission required';
    end if;
    select c.institution_id into v_institution_id from public.courses c where c.id=p_course_id;
    v_destination_bucket := 'ed-course-materials';
    v_destination_path := p_course_id::text || '/' || v_user_id::text || '/' || v_file_id::text || '/' || p_safe_name;
  elsif p_purpose='submission' then
    if p_course_id is null or p_assignment_id is null or not private.can_access_assignment(p_assignment_id) then
      raise exception 'Assignment access required';
    end if;
    if not exists (select 1 from public.assignments a where a.id=p_assignment_id and a.course_id=p_course_id) then
      raise exception 'Assignment does not belong to the course';
    end if;
    select c.institution_id into v_institution_id from public.courses c where c.id=p_course_id;
    v_destination_bucket := 'ed-submissions';
    v_destination_path := p_course_id::text || '/' || p_assignment_id::text || '/' || v_user_id::text || '/' || v_file_id::text || '/' || p_safe_name;
  elsif p_purpose='publication' then
    if p_publication_id is null or not exists (
      select 1 from public.publications p where p.id=p_publication_id and p.owner_id=v_user_id
    ) then
      raise exception 'Publication ownership required';
    end if;
    select c.institution_id
    into v_institution_id
    from public.publications p
    left join public.courses c on c.id=p.course_id
    where p.id=p_publication_id;
    v_destination_bucket := 'ed-publications';
    v_destination_path := v_user_id::text || '/' || p_publication_id::text || '/' || v_file_id::text || '/' || p_safe_name;
  else
    v_destination_bucket := 'ed-private-vault';
    v_destination_path := v_user_id::text || '/' || v_file_id::text || '/' || p_safe_name;
  end if;

  v_quarantine_path := v_user_id::text || '/' || v_file_id::text || '/' || p_safe_name;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));

  update public.upload_quota_reservations
  set status='expired',updated_at=now()
  where user_id=v_user_id and status='reserved' and expires_at <= now();

  select coalesce(sum(coalesce(f.actual_size_bytes,f.expected_size_bytes)),0)
  into v_used
  from public.secure_file_objects f
  where f.owner_id=v_user_id
    and f.upload_status='uploaded'
    and f.availability_status <> 'deleted';

  select coalesce(sum(r.reserved_bytes),0)
  into v_reserved
  from public.upload_quota_reservations r
  where r.user_id=v_user_id and r.status='reserved' and r.expires_at > now();

  if v_used + v_reserved + p_size_bytes > v_quota then
    raise exception 'Storage quota exceeded: % of % bytes are already used or reserved',v_used+v_reserved,v_quota;
  end if;

  v_retention_days := private.effective_retention_days(v_user_id,v_institution_id,p_course_id,p_purpose);
  v_retention_until := now() + make_interval(days => v_retention_days);

  insert into public.secure_file_objects (
    id,owner_id,institution_id,course_id,assignment_id,publication_id,purpose,
    original_name,safe_name,claimed_mime_type,expected_size_bytes,
    quarantine_path,destination_bucket,destination_path,
    preview_status,conversion_status,retention_until,upload_expires_at,metadata
  ) values (
    v_file_id,v_user_id,v_institution_id,p_course_id,p_assignment_id,p_publication_id,p_purpose,
    p_original_name,p_safe_name,p_claimed_mime_type,p_size_bytes,
    v_quarantine_path,v_destination_bucket,v_destination_path,
    case when p_claimed_mime_type in ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/epub+zip') then 'pending' else 'not_requested' end,
    case when p_purpose='publication' then 'queued' else 'not_requested' end,
    v_retention_until,v_upload_expires_at,coalesce(p_metadata,'{}'::jsonb)
  );

  insert into public.upload_quota_reservations (secure_file_id,user_id,reserved_bytes,expires_at)
  values (v_file_id,v_user_id,p_size_bytes,v_upload_expires_at);

  insert into public.audit_events (
    actor_id,institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_institution_id,p_course_id,p_assignment_id,v_file_id,
    'upload.reserved','secure_file',v_file_id::text,
    jsonb_build_object('purpose',p_purpose,'size_bytes',p_size_bytes,'plan_key',v_plan_key,'safe_name',p_safe_name),''
  );

  return query select
    v_file_id,'ed-quarantine'::text,v_quarantine_path,v_destination_bucket,v_destination_path,
    v_plan_key,v_quota,v_max_file,v_used,v_reserved,v_retention_until,v_upload_expires_at;
end;
$$;

revoke all on function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) from public;
grant execute on function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) to authenticated;

create or replace function public.get_my_storage_usage()
returns table (
  plan_key text,
  quota_bytes bigint,
  max_file_bytes bigint,
  used_bytes bigint,
  reserved_bytes bigint,
  available_bytes bigint
)
language sql
stable
security definer
set search_path=''
as $$
  with me as (
    select auth.uid() as user_id
  ), plan as (
    select coalesce(nullif(p.plan_key,''),'free') as plan_key
    from public.profiles p,me
    where p.id=me.user_id
  ), limits as (
    select spl.plan_key,spl.quota_bytes,spl.max_file_bytes
    from public.storage_plan_limits spl,plan
    where spl.plan_key=plan.plan_key and spl.active
  ), usage as (
    select coalesce(sum(coalesce(f.actual_size_bytes,f.expected_size_bytes)),0)::bigint as used_bytes
    from public.secure_file_objects f,me
    where f.owner_id=me.user_id and f.upload_status='uploaded' and f.availability_status <> 'deleted'
  ), reservations as (
    select coalesce(sum(r.reserved_bytes),0)::bigint as reserved_bytes
    from public.upload_quota_reservations r,me
    where r.user_id=me.user_id and r.status='reserved' and r.expires_at > now()
  )
  select limits.plan_key,limits.quota_bytes,limits.max_file_bytes,usage.used_bytes,reservations.reserved_bytes,
    greatest(limits.quota_bytes-usage.used_bytes-reservations.reserved_bytes,0)::bigint
  from limits,usage,reservations;
$$;

revoke all on function public.get_my_storage_usage() from public;
grant execute on function public.get_my_storage_usage() to authenticated;

create or replace function public.request_secure_file_deletion(p_secure_file_id uuid,p_reason text default '')
returns table (request_id uuid,status text,eligible_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid := gen_random_uuid();
  v_status text;
  v_eligible_at timestamptz;
  v_file public.secure_file_objects%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_secure_file(p_secure_file_id,v_user_id) then raise exception 'File management permission required'; end if;

  select * into v_file from public.secure_file_objects where id=p_secure_file_id for update;

  if private.file_is_on_legal_hold(p_secure_file_id) then
    v_status := 'blocked_legal_hold';
    v_eligible_at := null;
  elsif v_file.retention_until is not null and v_file.retention_until > now() then
    v_status := 'deferred_retention';
    v_eligible_at := v_file.retention_until;
  else
    v_status := 'eligible';
    v_eligible_at := now();
    update public.secure_file_objects
    set availability_status='pending_delete',delete_requested_at=now(),updated_at=now()
    where id=p_secure_file_id;
  end if;

  insert into public.file_deletion_requests (id,secure_file_id,requested_by,reason,status,eligible_at)
  values (v_request_id,p_secure_file_id,v_user_id,coalesce(p_reason,''),v_status,v_eligible_at);

  insert into public.audit_events (
    actor_id,institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_file.institution_id,v_file.course_id,v_file.assignment_id,p_secure_file_id,
    'delete.requested','secure_file',p_secure_file_id::text,
    jsonb_build_object('status',v_status,'eligible_at',v_eligible_at,'reason',coalesce(p_reason,'')),''
  );

  return query select v_request_id,v_status,v_eligible_at;
end;
$$;

revoke all on function public.request_secure_file_deletion(uuid,text) from public;
grant execute on function public.request_secure_file_deletion(uuid,text) to authenticated;
