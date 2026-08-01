-- Connect professor-published media to real learning work without treating
-- playback as proof of attention, understanding, or completion.

alter table public.learning_resources
  add column if not exists learning_requirement text not null default 'optional',
  add column if not exists completion_rule text not null default 'none',
  add column if not exists completion_target_key text,
  add column if not exists learning_due_at timestamptz,
  add column if not exists estimated_minutes integer not null default 15;

alter table public.learning_resources
  add constraint learning_resources_learning_requirement_check
    check (learning_requirement in ('optional','required')),
  add constraint learning_resources_completion_rule_check
    check (completion_rule in ('none','lesson','knowledge_check','assignment')),
  add constraint learning_resources_estimated_minutes_check
    check (estimated_minutes between 1 and 10080),
  add constraint learning_resources_learning_shape_check
    check (
      (
        learning_requirement='optional'
        and completion_rule='none'
        and completion_target_key is null
        and learning_due_at is null
      )
      or (
        learning_requirement='required'
        and resource_type in ('youtube','video','audio','image')
        and (
          (
            target_kind='lesson'
            and completion_rule='lesson'
            and completion_target_key=target_key
          )
          or (
            target_kind='lesson'
            and completion_rule='knowledge_check'
            and char_length(trim(coalesce(completion_target_key,''))) between 1 and 160
          )
          or (
            target_kind='assignment'
            and completion_rule='assignment'
            and completion_target_key=target_key
          )
        )
      )
    );

create index learning_resources_required_learning_idx
  on public.learning_resources (course_id,learning_due_at,target_kind,target_key)
  where learning_requirement='required' and deleted_at is null;

create or replace function private.guard_media_learning_requirement()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.learning_requirement='optional' then
    if new.completion_rule<>'none'
       or new.completion_target_key is not null
       or new.learning_due_at is not null then
      raise exception 'Optional media cannot create a required learning deadline or completion rule';
    end if;
  else
    if new.resource_type not in ('youtube','video','audio','image') then
      raise exception 'Only accessible media can be configured as a required learning step';
    end if;
    if new.target_kind='lesson' and new.completion_rule='lesson' then
      if new.completion_target_key is distinct from new.target_key then
        raise exception 'Lesson completion must target the same lesson as the media';
      end if;
    elsif new.target_kind='lesson' and new.completion_rule='knowledge_check' then
      if char_length(trim(coalesce(new.completion_target_key,'')))=0 then
        raise exception 'Required media needs an exact knowledge-check target';
      end if;
    elsif new.target_kind='assignment' and new.completion_rule='assignment' then
      if new.completion_target_key is distinct from new.target_key then
        raise exception 'Assignment completion must target the same assignment as the media';
      end if;
    else
      raise exception 'Required media must connect to its lesson, knowledge check, or assignment';
    end if;
  end if;

  if tg_op='UPDATE' and row(
    new.learning_requirement,new.completion_rule,new.completion_target_key,
    new.learning_due_at,new.estimated_minutes
  ) is distinct from row(
    old.learning_requirement,old.completion_rule,old.completion_target_key,
    old.learning_due_at,old.estimated_minutes
  ) then
    new.course_publication_state:='draft';
    new.course_publication_id:=null;
    new.course_publication_version:=null;
    new.course_published_at:=null;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_media_learning_requirement()
from public,anon,authenticated;

drop trigger if exists learning_resources_learning_requirement_guard
on public.learning_resources;
create trigger learning_resources_learning_requirement_guard
before insert or update of
  learning_requirement,completion_rule,completion_target_key,
  learning_due_at,estimated_minutes
on public.learning_resources
for each row execute function private.guard_media_learning_requirement();

alter table public.course_publication_resources
  add column if not exists learning_requirement text not null default 'optional',
  add column if not exists completion_rule text not null default 'none',
  add column if not exists completion_target_key text,
  add column if not exists learning_due_at timestamptz,
  add column if not exists estimated_minutes integer not null default 15;

alter table public.course_publication_resources
  add constraint course_publication_resources_learning_requirement_check
    check (learning_requirement in ('optional','required')),
  add constraint course_publication_resources_completion_rule_check
    check (completion_rule in ('none','lesson','knowledge_check','assignment')),
  add constraint course_publication_resources_estimated_minutes_check
    check (estimated_minutes between 1 and 10080),
  add constraint course_publication_resources_learning_shape_check
    check (
      (
        learning_requirement='optional'
        and completion_rule='none'
        and completion_target_key is null
        and learning_due_at is null
      )
      or (
        learning_requirement='required'
        and (
          (target_kind='lesson' and completion_rule in ('lesson','knowledge_check'))
          or (target_kind='assignment' and completion_rule='assignment')
        )
        and char_length(trim(coalesce(completion_target_key,''))) between 1 and 160
      )
    );

create index course_publication_resources_required_due_idx
  on public.course_publication_resources
    (publication_id,version_number,learning_due_at,target_kind,target_key)
  where learning_requirement='required';

create table public.media_learning_progress (
  id uuid primary key default gen_random_uuid(),
  publication_resource_id uuid not null references public.course_publication_resources(id) on delete cascade,
  publication_id uuid not null references public.course_publications(id) on delete cascade,
  version_number integer not null check (version_number>0),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completion_rule text not null check (completion_rule in ('lesson','knowledge_check','assignment')),
  completion_target_key text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  completion_basis text check (
    completion_basis is null
    or completion_basis in ('lesson_completed','knowledge_check_submitted','assignment_submitted')
  ),
  completed_at timestamptz,
  last_evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_resource_id,user_id),
  check (
    (status='pending' and completion_basis is null and completed_at is null)
    or (status='completed' and completion_basis is not null and completed_at is not null)
  )
);

create index media_learning_progress_user_idx
  on public.media_learning_progress (user_id,publication_id,version_number,status);
create index media_learning_progress_course_idx
  on public.media_learning_progress (course_id,publication_resource_id,status);

alter table public.media_learning_progress enable row level security;
revoke all on public.media_learning_progress from anon,authenticated;
grant select,insert,update,delete on public.media_learning_progress to service_role;

create policy media_learning_progress_no_direct_browser_access
on public.media_learning_progress
for all to authenticated
using (false)
with check (false);

create or replace function private.media_learning_rule_completed(
  p_publication_resource_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((
    select case snapshot.completion_rule
      when 'lesson' then exists (
        select 1
        from public.course_lesson_progress progress
        where progress.publication_id=snapshot.publication_id
          and progress.user_id=p_user_id
          and progress.lesson_id=snapshot.target_key
          and progress.status='completed'
      )
      when 'knowledge_check' then exists (
        select 1
        from public.course_lesson_progress progress
        where progress.publication_id=snapshot.publication_id
          and progress.user_id=p_user_id
          and progress.lesson_id=snapshot.target_key
          and jsonb_extract_path_text(
            progress.interaction_state,'knowledgeChecked',snapshot.completion_target_key
          )='true'
      )
      when 'assignment' then exists (
        select 1
        from public.assignment_drafts draft
        where draft.student_id=p_user_id
          and draft.assignment_id::text=snapshot.completion_target_key
          and draft.status in ('submitted','returned','graded')
      )
      else false
    end
    from public.course_publication_resources snapshot
    where snapshot.id=p_publication_resource_id
      and snapshot.learning_requirement='required'
  ),false)
$$;

revoke all on function private.media_learning_rule_completed(uuid,uuid)
from public,anon,authenticated;

create or replace function private.refresh_media_learning_progress(
  p_publication_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_publication public.course_publications%rowtype;
begin
  select * into v_publication
  from public.course_publications publication
  where publication.id=p_publication_id
    and publication.status='published';
  if not found then return; end if;
  if not exists (
    select 1
    from public.course_memberships membership
    where membership.course_id=v_publication.course_id
      and membership.user_id=p_user_id
      and membership.role='learner'
      and (membership.access_expires_at is null or membership.access_expires_at>now())
  ) then return; end if;

  insert into public.media_learning_progress (
    publication_resource_id,publication_id,version_number,course_id,user_id,
    completion_rule,completion_target_key,status,completion_basis,
    completed_at,last_evaluated_at
  )
  select snapshot.id,snapshot.publication_id,snapshot.version_number,
    snapshot.course_id,p_user_id,snapshot.completion_rule,
    snapshot.completion_target_key,
    case when private.media_learning_rule_completed(snapshot.id,p_user_id)
      then 'completed' else 'pending' end,
    case when private.media_learning_rule_completed(snapshot.id,p_user_id) then
      case snapshot.completion_rule
        when 'lesson' then 'lesson_completed'
        when 'knowledge_check' then 'knowledge_check_submitted'
        when 'assignment' then 'assignment_submitted'
      end
      else null
    end,
    case when private.media_learning_rule_completed(snapshot.id,p_user_id)
      then now() else null end,
    now()
  from public.course_publication_resources snapshot
  where snapshot.publication_id=v_publication.id
    and snapshot.version_number=v_publication.current_version
    and snapshot.learning_requirement='required'
  on conflict (publication_resource_id,user_id) do update
  set status=case
        when public.media_learning_progress.status='completed' then 'completed'
        else excluded.status
      end,
      completion_rule=excluded.completion_rule,
      completion_target_key=excluded.completion_target_key,
      completion_basis=coalesce(
        public.media_learning_progress.completion_basis,excluded.completion_basis
      ),
      completed_at=coalesce(
        public.media_learning_progress.completed_at,excluded.completed_at
      ),
      last_evaluated_at=now(),
      updated_at=now();
end;
$$;

revoke all on function private.refresh_media_learning_progress(uuid,uuid)
from public,anon,authenticated;

create or replace function private.enrich_course_media_learning_snapshot()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_resource public.learning_resources%rowtype;
begin
  if new.resource_id is null then return new; end if;
  select * into v_resource
  from public.learning_resources resource
  where resource.id=new.resource_id;
  if not found then
    raise exception 'The learning resource is unavailable for course publication';
  end if;

  new.learning_requirement:=v_resource.learning_requirement;
  new.completion_rule:=v_resource.completion_rule;
  new.completion_target_key:=v_resource.completion_target_key;
  new.learning_due_at:=v_resource.learning_due_at;
  new.estimated_minutes:=v_resource.estimated_minutes;

  if new.learning_requirement='required'
     and new.completion_rule='knowledge_check'
     and not exists (
       select 1
       from public.course_publication_versions version,
            jsonb_array_elements(coalesce(version.manifest->'paths','[]'::jsonb)) path,
            jsonb_array_elements(coalesce(path->'nodes','[]'::jsonb)) lesson,
            jsonb_array_elements(coalesce(lesson->'knowledgeChecks','[]'::jsonb)) knowledge_check
       where version.publication_id=new.publication_id
         and version.version_number=new.version_number
         and lesson->>'id'=new.target_key
         and knowledge_check->>'id'=new.completion_target_key
     ) then
    raise exception 'Required media targets a knowledge check that is not in this publication version';
  end if;

  if new.learning_requirement='required'
     and new.completion_rule='assignment'
     and not exists (
       select 1 from public.assignments assignment
       where assignment.course_id=new.course_id
         and assignment.id::text=new.completion_target_key
         and assignment.status='published'
     ) then
    raise exception 'Required media must target a published assignment in the same course';
  end if;
  return new;
end;
$$;

revoke all on function private.enrich_course_media_learning_snapshot()
from public,anon,authenticated;

create trigger course_publication_resources_learning_enrichment
before insert on public.course_publication_resources
for each row execute function private.enrich_course_media_learning_snapshot();

create or replace function private.seed_course_media_learning_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.learning_requirement<>'required' then return new; end if;
  insert into public.media_learning_progress (
    publication_resource_id,publication_id,version_number,course_id,user_id,
    completion_rule,completion_target_key,status,completion_basis,
    completed_at,last_evaluated_at
  )
  select new.id,new.publication_id,new.version_number,new.course_id,
    membership.user_id,new.completion_rule,new.completion_target_key,
    case when private.media_learning_rule_completed(new.id,membership.user_id)
      then 'completed' else 'pending' end,
    case when private.media_learning_rule_completed(new.id,membership.user_id) then
      case new.completion_rule
        when 'lesson' then 'lesson_completed'
        when 'knowledge_check' then 'knowledge_check_submitted'
        when 'assignment' then 'assignment_submitted'
      end
      else null
    end,
    case when private.media_learning_rule_completed(new.id,membership.user_id)
      then now() else null end,
    now()
  from public.course_memberships membership
  where membership.course_id=new.course_id
    and membership.role='learner'
    and (membership.access_expires_at is null or membership.access_expires_at>now())
  on conflict (publication_resource_id,user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.seed_course_media_learning_progress()
from public,anon,authenticated;

create trigger course_publication_resources_learning_seed
after insert on public.course_publication_resources
for each row execute function private.seed_course_media_learning_progress();

create or replace function private.sync_media_learning_from_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.refresh_media_learning_progress(new.publication_id,new.user_id);
  return new;
end;
$$;

revoke all on function private.sync_media_learning_from_lesson_progress()
from public,anon,authenticated;

create trigger course_lesson_progress_media_learning_sync
after insert or update of status,interaction_state
on public.course_lesson_progress
for each row execute function private.sync_media_learning_from_lesson_progress();

create or replace function private.sync_media_learning_from_assignment_draft()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_publication_id uuid;
begin
  for v_publication_id in
    select publication.id
    from public.course_publications publication
    join public.assignments assignment on assignment.course_id=publication.course_id
    where assignment.id=new.assignment_id
      and publication.status='published'
  loop
    perform private.refresh_media_learning_progress(v_publication_id,new.student_id);
  end loop;
  return new;
end;
$$;

revoke all on function private.sync_media_learning_from_assignment_draft()
from public,anon,authenticated;

create trigger assignment_drafts_media_learning_sync
after insert or update of status
on public.assignment_drafts
for each row execute function private.sync_media_learning_from_assignment_draft();

create or replace function public.get_published_course_resources(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_publication public.course_publications%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_publication
  from public.course_publications publication
  where publication.id=p_publication_id
    and publication.status='published';
  if not found or not private.can_access_course(v_publication.course_id) then
    raise exception 'Published course resources are unavailable or access is denied';
  end if;

  perform private.refresh_media_learning_progress(v_publication.id,v_user_id);

  return jsonb_build_object(
    'publication_id',v_publication.id,
    'course_id',v_publication.course_id,
    'version_number',v_publication.current_version,
    'resources',coalesce((
      select jsonb_agg(to_jsonb(resource_row) order by resource_row.position,resource_row.published_at,resource_row.title)
      from (
        select snapshot.id,snapshot.resource_id,snapshot.resource_type,
          snapshot.title,snapshot.description,snapshot.placement,
          snapshot.target_kind,snapshot.target_key,snapshot.embed_provider,
          snapshot.embed_key,snapshot.external_url,snapshot.secure_file_id,
          snapshot.mime_type,snapshot.alt_text,snapshot.source_label,
          snapshot.license_label,snapshot.position,snapshot.published_at,
          snapshot.resource_family_id,snapshot.resource_version,
          snapshot.supersedes_resource_id,snapshot.caption_mode,
          snapshot.caption_language,snapshot.caption_url,
          snapshot.transcript_text,snapshot.accessibility_notes,
          snapshot.is_decorative,snapshot.accessibility_status,
          snapshot.learning_requirement,snapshot.completion_rule,
          snapshot.completion_target_key,snapshot.learning_due_at,
          snapshot.estimated_minutes,
          (
            select jsonb_build_object(
              'status',progress.status,
              'last_position_seconds',progress.last_position_seconds,
              'max_position_seconds',progress.max_position_seconds,
              'duration_seconds',progress.duration_seconds,
              'percent_complete',progress.percent_complete,
              'transcript_opened',progress.transcript_opened,
              'captions_enabled',progress.captions_enabled,
              'completed_at',progress.completed_at,
              'updated_at',progress.updated_at
            )
            from public.media_viewing_progress progress
            where progress.publication_resource_id=snapshot.id
              and progress.user_id=v_user_id
          ) as viewing_progress,
          (
            select jsonb_build_object(
              'status',learning.status,
              'completion_basis',learning.completion_basis,
              'completed_at',learning.completed_at,
              'last_evaluated_at',learning.last_evaluated_at
            )
            from public.media_learning_progress learning
            where learning.publication_resource_id=snapshot.id
              and learning.user_id=v_user_id
          ) as learning_progress
        from public.course_publication_resources snapshot
        left join public.learning_resources current_resource
          on current_resource.id=snapshot.resource_id
        where snapshot.publication_id=v_publication.id
          and snapshot.version_number=v_publication.current_version
          and (
            snapshot.secure_file_id is null
            or (
              current_resource.id is not null
              and current_resource.deleted_at is null
              and current_resource.security_status='clean'
            )
          )
      ) resource_row
    ),'[]'::jsonb),
    'reader_policy',jsonb_build_object(
      'youtubeHost','https://www.youtube-nocookie.com',
      'autoplay',false,
      'externalPagesEmbedded',false,
      'personalResourcesPrivate',true,
      'captionsTravelWithVersion',true,
      'progressEvidence','aggregate_not_learning_proof',
      'learningCompletion','linked_activity_only',
      'playbackCompletesLearning',false
    )
  );
end;
$$;

create or replace function public.get_course_media_evidence(
  p_course_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_publication public.course_publications%rowtype;
  v_eligible integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) then
    raise exception 'Professor course access is required';
  end if;
  select * into v_publication
  from public.course_publications publication
  where publication.course_id=p_course_id;
  select count(*)::integer into v_eligible
  from public.course_memberships membership
  where membership.course_id=p_course_id
    and membership.role='learner'
    and (membership.access_expires_at is null or membership.access_expires_at>now());

  return jsonb_build_object(
    'course_id',p_course_id,
    'publication_id',v_publication.id,
    'version_number',coalesce(v_publication.current_version,0),
    'eligible_learners',v_eligible,
    'required_resources',coalesce((
      select count(*) from public.course_publication_resources snapshot
      where snapshot.publication_id=v_publication.id
        and snapshot.version_number=v_publication.current_version
        and snapshot.learning_requirement='required'
    ),0),
    'accessibility_ready_resources',coalesce((
      select count(*) from public.course_publication_resources snapshot
      where snapshot.publication_id=v_publication.id
        and snapshot.version_number=v_publication.current_version
        and snapshot.accessibility_status='ready'
    ),0),
    'resources',coalesce((
      select jsonb_agg(jsonb_build_object(
        'publication_resource_id',snapshot.id,
        'resource_id',snapshot.resource_id,
        'resource_family_id',snapshot.resource_family_id,
        'resource_version',snapshot.resource_version,
        'title',snapshot.title,
        'resource_type',snapshot.resource_type,
        'accessibility_status',snapshot.accessibility_status,
        'learning_requirement',snapshot.learning_requirement,
        'completion_rule',snapshot.completion_rule,
        'completion_target_key',snapshot.completion_target_key,
        'learning_due_at',snapshot.learning_due_at,
        'started_learners',coalesce(viewing.started_learners,0),
        'completed_learners',coalesce(viewing.completed_learners,0),
        'playback_completed_learners',coalesce(viewing.completed_learners,0),
        'transcript_learners',coalesce(viewing.transcript_learners,0),
        'caption_learners',coalesce(viewing.caption_learners,0),
        'average_percent',coalesce(viewing.average_percent,0),
        'last_activity_at',viewing.last_activity_at,
        'learning_completed_learners',coalesce(learning.completed_learners,0),
        'learning_completion_percent',case
          when v_eligible=0 then 0
          else round((coalesce(learning.completed_learners,0)::numeric/v_eligible::numeric)*100,2)
        end
      ) order by snapshot.position,snapshot.title)
      from public.course_publication_resources snapshot
      left join lateral (
        select
          count(*) filter (where progress.status<>'not_started')::integer as started_learners,
          count(*) filter (where progress.status='completed')::integer as completed_learners,
          count(*) filter (where progress.transcript_opened)::integer as transcript_learners,
          count(*) filter (where progress.captions_enabled)::integer as caption_learners,
          round(avg(progress.percent_complete),2) as average_percent,
          max(progress.updated_at) as last_activity_at
        from public.media_viewing_progress progress
        join public.course_memberships membership
          on membership.course_id=progress.course_id
         and membership.user_id=progress.user_id
         and membership.role='learner'
         and (membership.access_expires_at is null or membership.access_expires_at>now())
        where progress.publication_resource_id=snapshot.id
      ) viewing on true
      left join lateral (
        select count(*) filter (where progress.status='completed')::integer as completed_learners
        from public.media_learning_progress progress
        join public.course_memberships membership
          on membership.course_id=progress.course_id
         and membership.user_id=progress.user_id
         and membership.role='learner'
         and (membership.access_expires_at is null or membership.access_expires_at>now())
        where progress.publication_resource_id=snapshot.id
      ) learning on true
      where snapshot.publication_id=v_publication.id
        and snapshot.version_number=v_publication.current_version
    ),'[]'::jsonb),
    'evidence_policy',jsonb_build_object(
      'individualPlaybackLogExposed',false,
      'ipOrDeviceDataCollected',false,
      'playbackProvesLearning',false,
      'learningCompletionSource','linked_lesson_knowledge_check_or_assignment',
      'gradingUse','Use the linked assessment result, never viewing percentage, for academic decisions.'
    )
  );
end;
$$;

revoke all on function public.get_published_course_resources(uuid)
from public,anon;
revoke all on function public.get_course_media_evidence(uuid)
from public,anon;
grant execute on function public.get_published_course_resources(uuid)
to authenticated;
grant execute on function public.get_course_media_evidence(uuid)
to authenticated;
