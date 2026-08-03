-- Make the existing EdNotebook/TOS control plane authoritative by education
-- division. `both` is reserved for shared safeguards and legacy defaults.

alter table public.feature_policies
  add column education_division text not null default 'both'
  check (education_division in ('university','k12','both'));
alter table public.feature_change_sets
  add column education_division text not null default 'both'
  check (education_division in ('university','k12','both'));
alter table public.integration_connections
  add column education_division text not null default 'both'
  check (education_division in ('university','k12','both'));

drop index public.feature_policies_one_current_scope_idx;
create unique index feature_policies_one_current_scope_idx
  on public.feature_policies (
    feature_key,education_division,scope_type,
    coalesce(institution_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(pathway,''),
    coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ) where control_status in ('scheduled','active');

create or replace function private.resolve_feature_control(
  p_feature_key text,
  p_pathway text,
  p_institution_id uuid,
  p_course_id uuid,
  p_user_id uuid,
  p_education_division text,
  p_at timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_definition public.feature_definitions%rowtype; v_policy public.feature_policies%rowtype;
begin
  if p_education_division not in ('university','k12') then raise exception 'Unknown education division'; end if;
  select * into v_definition from public.feature_definitions fd where fd.feature_key=p_feature_key and fd.active;
  if not found then return null; end if;
  select fp.* into v_policy
  from public.feature_policies fp
  where fp.feature_key=p_feature_key
    and fp.education_division in (p_education_division,'both')
    and private.policy_is_effective(fp,p_at)
    and (
      fp.scope_type='platform'
      or (fp.scope_type='platform_pathway' and fp.pathway=p_pathway)
      or (fp.scope_type='institution' and fp.institution_id=p_institution_id)
      or (fp.scope_type='institution_pathway' and fp.institution_id=p_institution_id and fp.pathway=p_pathway)
      or (fp.scope_type='course' and fp.course_id=p_course_id)
      or (fp.scope_type='account' and fp.user_id=p_user_id and (fp.institution_id is null or fp.institution_id=p_institution_id))
    )
  order by
    case when fp.education_division=p_education_division then 1 else 0 end desc,
    case
      when fp.lock_descendants and fp.scope_type in ('platform','platform_pathway') then 100
      when fp.lock_descendants and fp.scope_type in ('institution','institution_pathway') then 95
      when fp.scope_type='account' then 80 when fp.scope_type='course' then 70
      when fp.scope_type='institution_pathway' then 60 when fp.scope_type='institution' then 50
      when fp.scope_type='platform_pathway' then 40 when fp.scope_type='platform' then 30 else 0 end desc,
    fp.created_at desc
  limit 1;
  return jsonb_build_object(
    'feature_key',v_definition.feature_key,'display_name',v_definition.display_name,
    'pathway',v_definition.pathway,'education_division',p_education_division,
    'value',coalesce(v_policy.control_value,v_definition.default_value),
    'source_scope',coalesce(v_policy.scope_type,'default'),
    'source_education_division',coalesce(v_policy.education_division,p_education_division),
    'locked',coalesce(v_policy.lock_descendants,false),'reason',coalesce(v_policy.reason,'Platform default'),
    'disable_behavior',v_definition.disable_behavior,'build_status',v_definition.build_status,
    'control_class',v_definition.control_class
  );
end;
$$;

create or replace function public.get_effective_feature_manifest(p_pathway text,p_course_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid()); v_institution_id uuid; v_education_division text; v_manifest jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_pathway not in ('student','professor','publisher','shared') then raise exception 'Unknown pathway'; end if;
  if p_course_id is not null then
    select course.institution_id,course.education_division into v_institution_id,v_education_division
    from public.courses course where course.id=p_course_id and private.can_access_course(course.id);
    if not found then raise exception 'Course access required'; end if;
  else
    select affiliation.institution_id into v_institution_id
    from public.institution_affiliations affiliation
    where affiliation.user_id=v_user_id and affiliation.pathway=p_pathway and affiliation.status='active' and affiliation.is_primary
    order by affiliation.updated_at desc limit 1;
    if p_pathway='student' then
      select path.current_division into v_education_division from public.student_education_paths path where path.user_id=v_user_id;
    elsif p_pathway='professor' then
      select case when request.education_division='k12' then 'k12' else 'university' end into v_education_division
      from public.educator_verification_requests request where request.user_id=v_user_id
      order by (request.status='approved') desc,request.updated_at desc limit 1;
    else v_education_division:='university'; end if;
  end if;
  v_education_division:=coalesce(v_education_division,'university');
  select coalesce(jsonb_agg(
    private.resolve_feature_control(definition.feature_key,p_pathway,v_institution_id,p_course_id,v_user_id,v_education_division,now())
    order by definition.sort_order,definition.display_name
  ),'[]'::jsonb) into v_manifest
  from public.feature_definitions definition
  where definition.active and definition.pathway in ('shared',p_pathway,'security','accessibility','theme','integration');
  return jsonb_build_object(
    'revision',coalesce((select max(policy.revision) from public.feature_policies policy where policy.education_division in (v_education_division,'both')),0),
    'pathway',p_pathway,'education_division',v_education_division,'institution_id',v_institution_id,
    'course_id',p_course_id,'features',v_manifest,'generated_at',now()
  );
end;
$$;

create or replace function private.preview_feature_control_change(p_input jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_definition public.feature_definitions%rowtype;
  v_division text := p_input->>'education_division';
  v_scope_type text := p_input->>'scope_type';
  v_institution_id uuid := nullif(p_input->>'institution_id','')::uuid;
  v_pathway text := nullif(p_input->>'pathway','');
  v_course_id uuid := nullif(p_input->>'course_id','')::uuid;
  v_target_user_id uuid := nullif(p_input->>'user_id','')::uuid;
  v_control_value jsonb := p_input->'control_value';
  v_allowed_scope text;
  v_accounts integer := 0;
  v_courses integer := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_existing public.feature_policies%rowtype;
  v_checksum text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_division not in ('university','k12') then raise exception 'Choose University or Early Prep before previewing a control'; end if;
  select * into v_definition from public.feature_definitions where feature_key=p_input->>'feature_key' and active;
  if not found then raise exception 'Feature not found'; end if;
  if v_definition.control_type = 'status_only' or v_definition.control_class = 'kernel' then
    raise exception 'This is a required platform safeguard and is status-only';
  end if;
  if v_scope_type not in ('platform','platform_pathway','institution','institution_pathway','course','account') then
    raise exception 'Invalid control scope';
  end if;

  v_allowed_scope := case
    when v_scope_type in ('platform','platform_pathway') then case when v_scope_type='platform' then 'platform' else 'pathway' end
    when v_scope_type in ('institution','institution_pathway') then case when v_scope_type='institution' then 'institution' else 'pathway' end
    when v_scope_type='course' then 'course'
    else 'account'
  end;
  if not (v_allowed_scope = any(v_definition.allowed_scopes)) then raise exception 'This feature cannot be controlled at the selected scope'; end if;

  if v_scope_type in ('platform','platform_pathway') then
    if not private.is_platform_owner(v_user_id) then raise exception 'Only the platform owner can change platform controls'; end if;
  else
    if v_institution_id is null then raise exception 'Institution is required for this scope'; end if;
    if not (
      private.is_platform_owner(v_user_id)
      or (
        v_definition.institution_delegable
        and private.has_institution_capability(v_institution_id, 'control_features', v_user_id)
      )
    ) then raise exception 'Institution feature-control access required'; end if;
    if exists (
      select 1 from public.feature_policies fp
      where fp.feature_key=v_definition.feature_key
        and fp.education_division in (v_division,'both')
        and fp.scope_type in ('platform','platform_pathway')
        and fp.lock_descendants
        and private.policy_is_effective(fp, now())
        and (fp.pathway is null or fp.pathway=coalesce(v_pathway,v_definition.pathway))
    ) then raise exception 'The platform owner locked this feature for lower scopes'; end if;
  end if;

  if v_scope_type='course' and not exists (
    select 1 from public.courses c
    where c.id=v_course_id and c.institution_id=v_institution_id and c.education_division=v_division
  ) then raise exception 'Course does not belong to the selected institution and education division'; end if;
  if v_scope_type='account' and not exists (
    select 1 from public.institution_affiliations ia
    where ia.user_id=v_target_user_id and ia.institution_id=v_institution_id and ia.status in ('active','pending')
      and private.user_has_education_division(ia.user_id,v_division)
  ) then raise exception 'Account does not belong to the selected institution and education division'; end if;

  if v_control_value is null then raise exception 'Control value is required'; end if;
  if v_definition.value_type='boolean' and jsonb_typeof(v_control_value)<>'boolean' then raise exception 'This control requires an on or off value'; end if;
  if v_definition.value_type='number' and jsonb_typeof(v_control_value)<>'number' then raise exception 'This control requires a number'; end if;
  if v_definition.value_type='text' and jsonb_typeof(v_control_value)<>'string' then raise exception 'This control requires a listed text value'; end if;
  if v_definition.control_type='select' and jsonb_array_length(v_definition.allowed_values)>0 and not exists (
    select 1 from jsonb_array_elements(v_definition.allowed_values) allowed where allowed=v_control_value
  ) then raise exception 'Select one of the allowed values'; end if;
  if v_definition.value_type='number' and (
    (v_definition.minimum_value is not null and (v_control_value#>>'{}')::numeric < v_definition.minimum_value)
    or (v_definition.maximum_value is not null and (v_control_value#>>'{}')::numeric > v_definition.maximum_value)
  ) then raise exception 'Number is outside the allowed range'; end if;

  if jsonb_typeof(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) = 0
    or exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb)) as schedule_day(value)
      where value::smallint not between 0 and 6
    )
  then raise exception 'Choose one or more valid schedule days'; end if;
  if (nullif(p_input->>'local_start_time','') is null) <> (nullif(p_input->>'local_end_time','') is null) then
    raise exception 'A daily schedule requires both a start time and an end time';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name=coalesce(nullif(p_input->>'timezone_name',''),'America/Chicago')
  ) then raise exception 'Choose a recognized timezone'; end if;

  select * into v_existing
  from public.feature_policies fp
  where fp.feature_key=v_definition.feature_key
    and fp.education_division=v_division
    and fp.scope_type=v_scope_type
    and fp.institution_id is not distinct from v_institution_id
    and fp.pathway is not distinct from v_pathway
    and fp.course_id is not distinct from v_course_id
    and fp.user_id is not distinct from v_target_user_id
    and fp.control_status in ('scheduled','active')
  order by fp.created_at desc limit 1;

  if v_scope_type in ('platform','platform_pathway') then
    select count(distinct request.user_id)::integer into v_accounts
    from public.identity_onboarding_requests request where request.education_division in (v_division,'both');
    select count(*)::integer into v_courses from public.courses course where course.education_division=v_division;
  elsif v_scope_type in ('institution','institution_pathway') then
    select count(distinct request.user_id)::integer into v_accounts
    from public.identity_onboarding_requests request
    where request.education_division in (v_division,'both') and request.institution_id=v_institution_id;
    select count(*)::integer into v_courses from public.courses course
    where course.institution_id=v_institution_id and course.education_division=v_division;
  elsif v_scope_type='course' then
    select count(*)::integer into v_accounts from public.course_memberships cm where cm.course_id=v_course_id;
    v_courses := 1;
  else
    v_accounts := 1;
    v_courses := 0;
  end if;

  if v_definition.risk_level in ('high','critical') then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','high_impact','severity',v_definition.risk_level,'message',v_definition.impact_explanation));
  end if;
  if v_control_value='false'::jsonb then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','access_removed','severity','high','message','People in this scope may lose access to this feature. Existing records are preserved.'));
  end if;
  if coalesce((p_input->>'lock_descendants')::boolean,false) then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','lower_overrides_locked','severity','high','message','Lower-level institution, course, and account overrides will no longer apply while this lock is active.'));
  end if;
  if v_definition.control_class in ('security_required','accessibility_required') then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','required_control','severity','critical','message','This control protects security or accessibility. The platform owner must acknowledge the impact before changing it.'));
  end if;

  v_checksum := md5(
    p_input::text || '|' || v_division || '|' || coalesce(v_existing.id::text,'none') || '|' || coalesce(v_existing.revision::text,'0')
  );
  return jsonb_build_object(
    'checksum',v_checksum,
    'feature_key',v_definition.feature_key,
    'display_name',v_definition.display_name,
    'education_division',v_division,
    'scope_type',v_scope_type,
    'institution_id',v_institution_id,
    'pathway',v_pathway,
    'course_id',v_course_id,
    'user_id',v_target_user_id,
    'current_value',v_existing.control_value,
    'proposed_value',v_control_value,
    'warnings',v_warnings,
    'affected_accounts',v_accounts,
    'affected_courses',v_courses,
    'summary',format('%s will change for %s %s account(s) and %s course(s).',v_definition.display_name,v_accounts,v_division,v_courses)
  );
end;
$$;

create or replace function private.preview_division_feature_control_change(p_input jsonb)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select private.preview_feature_control_change(p_input); $$;

create or replace function public.preview_feature_control_change(p_input jsonb)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.preview_division_feature_control_change(p_input); $$;

create or replace function public.apply_feature_control_change(p_input jsonb,p_expected_checksum text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_preview jsonb; v_existing public.feature_policies%rowtype; v_policy public.feature_policies%rowtype;
  v_change_set public.feature_change_sets%rowtype; v_revision integer; v_control_status text;
  v_division text:=p_input->>'education_division';
  v_starts_at timestamptz:=nullif(p_input->>'starts_at','')::timestamptz;
  v_acks text[]:=coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'warning_acknowledgements','[]'::jsonb))),'{}');
begin
  v_preview:=private.preview_division_feature_control_change(p_input);
  if p_expected_checksum is null or p_expected_checksum<>v_preview->>'checksum' then raise exception 'The control changed after preview. Review the latest impact before applying.'; end if;
  if jsonb_array_length(v_preview->'warnings')>0 and cardinality(v_acks)=0 then raise exception 'Acknowledge the listed warnings before applying this change'; end if;
  if nullif(trim(p_input->>'reason'),'') is null then raise exception 'A plain-language reason is required'; end if;
  select * into v_existing from public.feature_policies policy
  where policy.feature_key=p_input->>'feature_key' and policy.education_division=v_division
    and policy.scope_type=p_input->>'scope_type'
    and policy.institution_id is not distinct from nullif(p_input->>'institution_id','')::uuid
    and policy.pathway is not distinct from nullif(p_input->>'pathway','')
    and policy.course_id is not distinct from nullif(p_input->>'course_id','')::uuid
    and policy.user_id is not distinct from nullif(p_input->>'user_id','')::uuid
    and policy.control_status in ('scheduled','active')
  order by policy.created_at desc limit 1 for update;
  v_revision:=coalesce(v_existing.revision,0)+1;
  if found then update public.feature_policies set control_status='revoked',revoked_by=(select auth.uid()),revoked_at=now() where id=v_existing.id; end if;
  v_control_status:=case when v_starts_at is not null and v_starts_at>now() then 'scheduled' else 'active' end;
  insert into public.feature_policies(
    feature_key,education_division,scope_type,institution_id,pathway,course_id,user_id,control_value,
    control_status,lock_descendants,reason,warning_acknowledgements,starts_at,ends_at,
    weekdays,local_start_time,local_end_time,timezone_name,revision,supersedes_policy_id,created_by
  ) values (
    p_input->>'feature_key',v_division,p_input->>'scope_type',nullif(p_input->>'institution_id','')::uuid,
    nullif(p_input->>'pathway',''),nullif(p_input->>'course_id','')::uuid,nullif(p_input->>'user_id','')::uuid,
    p_input->'control_value',v_control_status,coalesce((p_input->>'lock_descendants')::boolean,false),
    trim(p_input->>'reason'),v_acks,v_starts_at,nullif(p_input->>'ends_at','')::timestamptz,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'weekdays','[0,1,2,3,4,5,6]'::jsonb))::smallint),'{0,1,2,3,4,5,6}'::smallint[]),
    nullif(p_input->>'local_start_time','')::time,nullif(p_input->>'local_end_time','')::time,
    coalesce(nullif(p_input->>'timezone_name',''),'America/Chicago'),v_revision,v_existing.id,(select auth.uid())
  ) returning * into v_policy;
  insert into public.feature_change_sets(
    institution_id,education_division,actor_id,scope_summary,change_summary,reason,
    affected_account_count,affected_course_count,warnings,warning_acknowledgements,status,applied_at
  ) values (
    v_policy.institution_id,v_division,(select auth.uid()),v_policy.scope_type,v_preview->>'summary',v_policy.reason,
    (v_preview->>'affected_accounts')::integer,(v_preview->>'affected_courses')::integer,
    v_preview->'warnings',v_acks,'applied',now()
  ) returning * into v_change_set;
  insert into public.feature_change_items(change_set_id,feature_key,policy_id,before_value,after_value,before_status,after_status)
  values(v_change_set.id,v_policy.feature_key,v_policy.id,v_existing.control_value,v_policy.control_value,v_existing.control_status,v_policy.control_status);
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_policy.institution_id,v_policy.course_id,'admin.feature_control_changed','feature_policy',v_policy.id::text,
    jsonb_build_object('feature_key',v_policy.feature_key,'scope_type',v_policy.scope_type,'education_division',v_division,'revision',v_policy.revision,'change_set_id',v_change_set.id),'');
  return jsonb_build_object('policy',to_jsonb(v_policy),'change_set',to_jsonb(v_change_set),'preview',v_preview);
end;
$$;

create or replace function public.get_admin_control_center_by_division(p_institution_id uuid default null,p_education_division text default 'university')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_base jsonb; v_statistics jsonb;
begin
  if p_education_division not in ('university','k12') then raise exception 'Unknown education division'; end if;
  v_base:=public.get_admin_control_center(p_institution_id);
  v_statistics:=(v_base->'statistics') || jsonb_build_object(
    'accounts',(select count(distinct request.user_id) from public.identity_onboarding_requests request where request.education_division in (p_education_division,'both') and (p_institution_id is null or request.institution_id=p_institution_id)),
    'courses',(select count(*) from public.courses course where course.education_division=p_education_division and (p_institution_id is null or course.institution_id=p_institution_id)),
    'pending_affiliations',(select count(*) from public.identity_onboarding_requests request where request.verification_status='pending' and request.education_division in (p_education_division,'both') and (p_institution_id is null or request.institution_id=p_institution_id))
  );
  return v_base || jsonb_build_object(
    'education_division',p_education_division,
    'institutions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',institution.id,'name',institution.name,'slug',institution.slug,'institution_code',institution.institution_code,
      'primary_lms',institution.primary_lms,'lifecycle_status',institution.lifecycle_status,'institution_type',institution.institution_type,
      'system_name',institution.system_name,'timezone_name',institution.timezone_name,'education_division',institution.education_division
    ) order by institution.name) from public.institutions institution where institution.education_division=p_education_division and (p_institution_id is null or institution.id=p_institution_id)),'[]'::jsonb),
    'statistics',v_statistics,
    'policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.created_at desc) from public.feature_policies policy where policy.control_status in ('scheduled','active') and policy.education_division in (p_education_division,'both') and (p_institution_id is null or policy.institution_id=p_institution_id or policy.scope_type in ('platform','platform_pathway'))),'[]'::jsonb),
    'connections',coalesce((select jsonb_agg((to_jsonb(connection)-'secret_reference_names') order by connection.category,connection.display_name) from public.integration_connections connection where connection.education_division in (p_education_division,'both') and (p_institution_id is null or connection.institution_id is null or connection.institution_id=p_institution_id)),'[]'::jsonb),
    'changes',coalesce((select jsonb_agg(to_jsonb(change_set) order by change_set.created_at desc) from (select * from public.feature_change_sets change_set where change_set.education_division in (p_education_division,'both') and (p_institution_id is null or change_set.institution_id=p_institution_id) order by change_set.created_at desc limit 200) change_set),'[]'::jsonb),
    'onboarding_requests',coalesce((select jsonb_agg(request) from jsonb_array_elements(v_base->'onboarding_requests') request where request->>'education_division' in (p_education_division,'both')),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_search_accounts_courses_by_division(p_query text,p_institution_id uuid default null,p_pathway text default null,p_education_division text default 'university')
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_user_id uuid:=(select auth.uid()); v_query text:=lower(trim(coalesce(p_query,'')));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_education_division not in ('university','k12') then raise exception 'Unknown education division'; end if;
  if p_institution_id is null and not private.has_platform_control_access(v_user_id) then raise exception 'Platform search access required'; end if;
  if p_institution_id is not null and not (private.has_platform_control_access(v_user_id) or private.has_institution_capability(p_institution_id,'view_accounts',v_user_id)) then raise exception 'Institution account-search access required'; end if;
  return jsonb_build_object(
    'education_division',p_education_division,
    'accounts',coalesce((select jsonb_agg(row_data order by row_data->>'full_name') from (
      select distinct jsonb_build_object(
        'user_id',profile.id,'full_name',profile.full_name,'email',profile.email,'platform_role',profile.role,
        'institution_id',affiliation.institution_id,'pathway',affiliation.pathway,'affiliation_status',affiliation.status,
        'membership_role',membership.role,'membership_status',membership.status,'education_division',p_education_division
      ) row_data
      from public.profiles profile
      left join public.institution_affiliations affiliation on affiliation.user_id=profile.id and (p_institution_id is null or affiliation.institution_id=p_institution_id)
      left join public.institution_memberships membership on membership.user_id=profile.id and (p_institution_id is null or membership.institution_id=p_institution_id)
      where private.user_has_education_division(profile.id,p_education_division)
        and (p_institution_id is null or affiliation.institution_id=p_institution_id or membership.institution_id=p_institution_id)
        and (p_pathway is null or affiliation.pathway=p_pathway)
        and (v_query='' or lower(coalesce(profile.full_name,'')) like '%'||v_query||'%' or lower(coalesce(profile.email,'')) like '%'||v_query||'%')
      limit 75
    ) account_rows),'[]'::jsonb),
    'courses',coalesce((select jsonb_agg(jsonb_build_object(
      'id',course.id,'institution_id',course.institution_id,'title',course.title,'course_code',course.course_code,
      'section_code',course.section_code,'teaching_window',course.teaching_window,'status',course.status,
      'access_scope',course.access_scope,'education_division',course.education_division,'subject_id',course.subject_id,
      'member_count',(select count(*) from public.course_memberships membership where membership.course_id=course.id)
    ) order by course.title) from public.courses course
    where course.education_division=p_education_division and (p_institution_id is null or course.institution_id=p_institution_id)
      and (v_query='' or lower(course.title) like '%'||v_query||'%' or lower(coalesce(course.course_code,'')) like '%'||v_query||'%') limit 75),'[]'::jsonb)
  );
end;
$$;

create or replace function public.record_admin_division_scope(p_institution_id uuid default null,p_education_division text default 'university')
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=(select auth.uid());
begin
  if p_education_division not in ('university','k12') then raise exception 'Unknown education division'; end if;
  if p_institution_id is null and not private.has_platform_control_access(v_user_id) then raise exception 'Platform control-center access required'; end if;
  if p_institution_id is not null and not (private.has_platform_control_access(v_user_id) or private.has_institution_capability(p_institution_id,'view_control_center',v_user_id)) then raise exception 'Institution control-center access required'; end if;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_user_id,p_institution_id,'admin.education_division_selected','education_division',p_education_division,jsonb_build_object('education_division',p_education_division),'');
end;
$$;

revoke all on function private.resolve_feature_control(text,text,uuid,uuid,uuid,text,timestamptz) from public;
revoke all on function private.preview_division_feature_control_change(jsonb) from public;
revoke all on function public.get_admin_control_center_by_division(uuid,text) from public,anon;
revoke all on function public.admin_search_accounts_courses_by_division(text,uuid,text,text) from public,anon;
revoke all on function public.record_admin_division_scope(uuid,text) from public,anon;
grant execute on function public.get_admin_control_center_by_division(uuid,text) to authenticated;
grant execute on function public.admin_search_accounts_courses_by_division(text,uuid,text,text) to authenticated;
grant execute on function public.record_admin_division_scope(uuid,text) to authenticated;
