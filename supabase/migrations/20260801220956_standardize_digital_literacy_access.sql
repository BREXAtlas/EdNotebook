-- Make the canonical Digital Literacy course a platform standard without
-- duplicating student evidence across professors. Student-owned completion is
-- versioned by catalog release; professor visibility remains course-scoped.

create table private.digital_literacy_standard_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  started_release_id text not null references public.digital_literacy_catalog_releases(release_id) on delete restrict,
  current_release_id text not null references public.digital_literacy_catalog_releases(release_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, student_id)
);

create index digital_literacy_standard_enrollments_started_release_idx
  on private.digital_literacy_standard_enrollments(started_release_id, student_id);
create index digital_literacy_standard_enrollments_current_release_idx
  on private.digital_literacy_standard_enrollments(current_release_id, student_id);

create table private.digital_literacy_standard_progress (
  enrollment_id uuid not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  release_id text not null,
  unit_id text not null,
  stars integer not null default 0 check (stars between 0 and 3),
  evidence_source text not null check (evidence_source in ('canonical_course_embed','canonical_course_account_sync')),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, release_id, unit_id),
  foreign key (enrollment_id, student_id)
    references private.digital_literacy_standard_enrollments(id, student_id) on delete cascade,
  foreign key (release_id, unit_id)
    references public.digital_literacy_catalog_units(release_id, unit_id) on delete restrict
);

create index digital_literacy_standard_progress_enrollment_idx
  on private.digital_literacy_standard_progress(enrollment_id, student_id);
create index digital_literacy_standard_progress_release_unit_idx
  on private.digital_literacy_standard_progress(release_id, unit_id);

alter table private.digital_literacy_standard_enrollments enable row level security;
alter table private.digital_literacy_standard_progress enable row level security;
revoke all on private.digital_literacy_standard_enrollments from public, anon, authenticated;
revoke all on private.digital_literacy_standard_progress from public, anon, authenticated;

create or replace function private.ensure_standard_digital_literacy_enrollment(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release_id text;
  v_enrollment_id uuid;
begin
  if p_student_id is null or not exists (
    select 1 from public.student_education_paths path where path.user_id=p_student_id
  ) then
    return null;
  end if;

  select release.release_id into v_release_id
  from public.digital_literacy_catalog_releases release
  where release.course_key='brexatlas.digital-literacy-course' and release.active;
  if v_release_id is null then raise exception 'No active canonical Digital Literacy release'; end if;

  insert into private.digital_literacy_standard_enrollments (
    student_id,started_release_id,current_release_id
  ) values (
    p_student_id,v_release_id,v_release_id
  )
  on conflict (student_id) do update set
    current_release_id=excluded.current_release_id,
    updated_at=case
      when private.digital_literacy_standard_enrollments.current_release_id<>excluded.current_release_id then now()
      else private.digital_literacy_standard_enrollments.updated_at
    end
  returning id into v_enrollment_id;
  return v_enrollment_id;
end;
$$;

create or replace function private.assign_standard_digital_literacy_on_student_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_standard_digital_literacy_enrollment(new.user_id);
  return new;
end;
$$;

drop trigger if exists student_path_assign_standard_digital_literacy on public.student_education_paths;
create trigger student_path_assign_standard_digital_literacy
after insert on public.student_education_paths
for each row execute function private.assign_standard_digital_literacy_on_student_path();

create or replace function private.follow_active_digital_literacy_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.course_key='brexatlas.digital-literacy-course' and new.active then
    update private.digital_literacy_standard_enrollments enrollment
    set current_release_id=new.release_id,updated_at=now()
    where enrollment.current_release_id<>new.release_id;
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_release_update_standard_digital_literacy on public.digital_literacy_catalog_releases;
create trigger catalog_release_update_standard_digital_literacy
after insert or update of active on public.digital_literacy_catalog_releases
for each row execute function private.follow_active_digital_literacy_release();

select private.ensure_standard_digital_literacy_enrollment(path.user_id)
from public.student_education_paths path;

create or replace function public.get_my_standard_digital_literacy_course()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_enrollment private.digital_literacy_standard_enrollments%rowtype;
  v_release public.digital_literacy_catalog_releases%rowtype;
  v_completed integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  perform private.ensure_standard_digital_literacy_enrollment(v_user_id);
  select * into v_enrollment
  from private.digital_literacy_standard_enrollments enrollment
  where enrollment.student_id=v_user_id;
  if not found then return jsonb_build_object('assignment',null); end if;

  select * into v_release
  from public.digital_literacy_catalog_releases release
  where release.release_id=v_enrollment.current_release_id;
  select count(*)::integer into v_completed
  from private.digital_literacy_standard_progress progress
  where progress.student_id=v_user_id and progress.release_id=v_release.release_id;

  return jsonb_build_object(
    'assignment',jsonb_build_object(
      'assignment_id',v_enrollment.id,
      'assignment_kind','platform_standard',
      'course_id',null,
      'course_title','EdNotebook platform standard',
      'course_code','STANDARD',
      'title','Digital Literacy · Platform Standard',
      'instructions','Complete the canonical course at your pace. Professors can assign specific units; your student-owned completion record is shared only with professors whose classes you join.',
      'due_at',null,
      'status',case when v_completed=v_release.unit_count then 'completed' when v_completed>0 then 'in_progress' else 'assigned' end,
      'completed_at',case when v_completed=v_release.unit_count then (
        select max(progress.completed_at) from private.digital_literacy_standard_progress progress
        where progress.student_id=v_user_id and progress.release_id=v_release.release_id
      ) else null end,
      'catalog_release',v_release.release_id,
      'started_release',v_enrollment.started_release_id,
      'source_home',v_release.source_home,
      'source_repository',v_release.source_repository,
      'units',(
        select jsonb_agg(jsonb_build_object(
          'unit_id',unit.unit_id,
          'title',unit.title,
          'path',unit.path,
          'position',unit.position,
          'relative_url',unit.relative_url,
          'completed',progress.unit_id is not null,
          'stars',coalesce(progress.stars,0),
          'completed_at',progress.completed_at
        ) order by unit.position)
        from public.digital_literacy_catalog_units unit
        left join private.digital_literacy_standard_progress progress
          on progress.student_id=v_user_id
          and progress.release_id=unit.release_id
          and progress.unit_id=unit.unit_id
        where unit.release_id=v_release.release_id
      )
    )
  );
end;
$$;

create or replace function public.get_digital_literacy_professor_standard_progress(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_release public.digital_literacy_catalog_releases%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) then raise exception 'Course management access required'; end if;
  select * into v_release from public.digital_literacy_catalog_releases release
  where release.course_key='brexatlas.digital-literacy-course' and release.active;

  return jsonb_build_object(
    'catalog_release',v_release.release_id,
    'total_units',v_release.unit_count,
    'learners',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'student_id',profile.id,
        'display_name',coalesce(nullif(btrim(profile.full_name),''),split_part(profile.email,'@',1),'Student'),
        'standard_assignment_id',enrollment.id,
        'completed_units',(
          select count(*) from private.digital_literacy_standard_progress progress
          where progress.student_id=profile.id and progress.release_id=v_release.release_id
        ),
        'last_activity_at',(
          select max(progress.updated_at) from private.digital_literacy_standard_progress progress
          where progress.student_id=profile.id and progress.release_id=v_release.release_id
        )
      ) order by coalesce(nullif(btrim(profile.full_name),''),profile.email)), '[]'::jsonb)
      from public.course_memberships membership
      join public.profiles profile on profile.id=membership.user_id
      left join private.digital_literacy_standard_enrollments enrollment on enrollment.student_id=profile.id
      where membership.course_id=p_course_id
        and membership.role='learner'
        and private.course_membership_is_current(membership.course_id,membership.user_id,membership.role)
    )
  );
end;
$$;

create or replace function public.sync_digital_literacy_assignment_progress(
  p_path text,
  p_completed_node_ids text[],
  p_stars jsonb,
  p_catalog_release text,
  p_evidence_source text default 'canonical_course_embed'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_completed_count integer := coalesce(cardinality(p_completed_node_ids),0);
  v_distinct_count integer;
  v_changed integer := 0;
  v_standard_changed integer := 0;
  v_enrollment_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_path not in ('foundations','ai-quest') then raise exception 'Canonical course path is invalid'; end if;
  if p_evidence_source not in ('canonical_course_embed','canonical_course_account_sync') then
    raise exception 'Digital Literacy evidence source is invalid';
  end if;
  if v_completed_count>20 then raise exception 'A course path cannot contain more than 20 units'; end if;
  if p_stars is null or jsonb_typeof(p_stars)<>'object' then raise exception 'Stars must use a bounded object'; end if;

  v_enrollment_id:=private.ensure_standard_digital_literacy_enrollment(v_user_id);
  perform 1
  from public.digital_literacy_catalog_releases release
  where release.release_id=p_catalog_release
    and release.course_key='brexatlas.digital-literacy-course'
    and (
      exists (
        select 1 from private.digital_literacy_standard_enrollments enrollment
        where enrollment.student_id=v_user_id and enrollment.current_release_id=release.release_id
      )
      or exists (
        select 1
        from public.digital_literacy_assignment_recipients recipient
        join public.assignments assignment on assignment.id=recipient.assignment_id
        join public.digital_literacy_assignment_units assignment_unit on assignment_unit.assignment_id=assignment.id
        where recipient.student_id=v_user_id
          and assignment.status='published'
          and assignment_unit.release_id=release.release_id
          and private.course_membership_is_current(assignment.course_id,v_user_id,'learner')
      )
    );
  if not found then raise exception 'Canonical Digital Literacy release is not assigned to this student'; end if;

  if v_completed_count>0 then
    select count(distinct unit_id)::integer into v_distinct_count from unnest(p_completed_node_ids) unit_id;
    if v_distinct_count<>v_completed_count then raise exception 'Completed units cannot be duplicated'; end if;
    if exists (
      select 1 from unnest(p_completed_node_ids) requested(unit_id)
      where not exists (
        select 1 from public.digital_literacy_catalog_units unit
        where unit.release_id=p_catalog_release and unit.path=p_path and unit.unit_id=requested.unit_id
      )
    ) then raise exception 'Progress contains an unknown canonical course unit'; end if;
  end if;

  insert into public.digital_literacy_progress (
    user_id,path,current_node_id,completed_node_ids,stars,updated_at
  ) values (
    v_user_id,p_path,
    case when v_completed_count>0 then p_completed_node_ids[v_completed_count] else null end,
    coalesce(p_completed_node_ids,'{}'::text[]),p_stars,now()
  )
  on conflict (user_id,path) do update set
    current_node_id=excluded.current_node_id,
    completed_node_ids=excluded.completed_node_ids,
    stars=excluded.stars,
    updated_at=excluded.updated_at;

  if v_completed_count>0 then
    insert into public.digital_literacy_assignment_progress (
      assignment_id,student_id,unit_id,status,stars,evidence_source,completed_at,updated_at
    )
    select recipient.assignment_id,v_user_id,unit.unit_id,'completed',
      case when jsonb_typeof(p_stars->unit.unit_id)='number'
        then least(3,greatest(0,(p_stars->>unit.unit_id)::integer)) else 0 end,
      p_evidence_source,now(),now()
    from public.digital_literacy_assignment_recipients recipient
    join public.assignments assignment on assignment.id=recipient.assignment_id
    join public.digital_literacy_assignment_units assignment_unit on assignment_unit.assignment_id=recipient.assignment_id
    join public.digital_literacy_catalog_units unit
      on unit.release_id=assignment_unit.release_id and unit.unit_id=assignment_unit.unit_id
    where recipient.student_id=v_user_id
      and assignment.status='published'
      and unit.release_id=p_catalog_release
      and unit.path=p_path
      and unit.unit_id=any(p_completed_node_ids)
      and private.course_membership_is_current(assignment.course_id,v_user_id,'learner')
    on conflict (assignment_id,student_id,unit_id) do update set
      stars=greatest(public.digital_literacy_assignment_progress.stars,excluded.stars),
      evidence_source=excluded.evidence_source,
      updated_at=excluded.updated_at;
    get diagnostics v_changed = row_count;

    if exists (
      select 1 from private.digital_literacy_standard_enrollments enrollment
      where enrollment.id=v_enrollment_id and enrollment.current_release_id=p_catalog_release
    ) then
      insert into private.digital_literacy_standard_progress (
        enrollment_id,student_id,release_id,unit_id,stars,evidence_source,completed_at,updated_at
      )
      select v_enrollment_id,v_user_id,unit.release_id,unit.unit_id,
        case when jsonb_typeof(p_stars->unit.unit_id)='number'
          then least(3,greatest(0,(p_stars->>unit.unit_id)::integer)) else 0 end,
        p_evidence_source,now(),now()
      from public.digital_literacy_catalog_units unit
      where unit.release_id=p_catalog_release
        and unit.path=p_path
        and unit.unit_id=any(p_completed_node_ids)
      on conflict (student_id,release_id,unit_id) do update set
        stars=greatest(private.digital_literacy_standard_progress.stars,excluded.stars),
        evidence_source=excluded.evidence_source,
        updated_at=excluded.updated_at;
      get diagnostics v_standard_changed = row_count;
    end if;
  end if;

  update public.digital_literacy_assignment_recipients recipient
  set status='in_progress'
  where recipient.student_id=v_user_id and recipient.status='assigned'
    and exists (
      select 1 from public.digital_literacy_assignment_progress progress
      where progress.assignment_id=recipient.assignment_id and progress.student_id=v_user_id
    );

  update public.digital_literacy_assignment_recipients recipient
  set status='completed',completed_at=coalesce(recipient.completed_at,now())
  where recipient.student_id=v_user_id and recipient.status<>'completed'
    and not exists (
      select 1 from public.digital_literacy_assignment_units required_unit
      where required_unit.assignment_id=recipient.assignment_id
        and not exists (
          select 1 from public.digital_literacy_assignment_progress progress
          where progress.assignment_id=recipient.assignment_id
            and progress.student_id=v_user_id
            and progress.unit_id=required_unit.unit_id
        )
    );

  if v_changed+v_standard_changed>0 then
    insert into public.audit_events (
      actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash
    ) values (
      v_user_id,null,null,'digital_literacy.progress_synchronized',
      'digital_literacy_catalog_release',p_catalog_release,
      jsonb_build_object(
        'path',p_path,
        'completed_count',v_completed_count,
        'assignment_rows_changed',v_changed,
        'standard_rows_changed',v_standard_changed,
        'evidence_source',p_evidence_source
      ),''
    );
  end if;

  return jsonb_build_object(
    'catalog_release',p_catalog_release,
    'path',p_path,
    'completed_node_ids',coalesce(p_completed_node_ids,'{}'::text[]),
    'assignment_rows_changed',v_changed,
    'standard_rows_changed',v_standard_changed,
    'assignments',public.get_my_digital_literacy_assignments(null)->'assignments'
  );
end;
$$;

revoke all on function private.ensure_standard_digital_literacy_enrollment(uuid) from public,anon,authenticated;
revoke all on function private.assign_standard_digital_literacy_on_student_path() from public,anon,authenticated;
revoke all on function private.follow_active_digital_literacy_release() from public,anon,authenticated;
revoke all on function public.get_my_standard_digital_literacy_course() from public,anon;
revoke all on function public.get_digital_literacy_professor_standard_progress(uuid) from public,anon;
revoke all on function public.sync_digital_literacy_assignment_progress(text,text[],jsonb,text,text) from public,anon;
grant execute on function public.get_my_standard_digital_literacy_course() to authenticated;
grant execute on function public.get_digital_literacy_professor_standard_progress(uuid) to authenticated;
grant execute on function public.sync_digital_literacy_assignment_progress(text,text[],jsonb,text,text) to authenticated;

comment on table private.digital_literacy_standard_enrollments is
  'One automatic canonical Digital Literacy enrollment per student pathway. Started release is immutable; current release follows the active governed catalog release.';
comment on table private.digital_literacy_standard_progress is
  'Student-owned, release-versioned canonical unit completion. Professor views are derived only through current course membership.';
