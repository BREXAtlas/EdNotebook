-- Govern media accessibility, immutable replacement lineage, and restrained
-- viewing-progress evidence. Playback evidence is an aggregate learning aid,
-- never proof of attention, understanding, attendance, or academic integrity.

alter table public.learning_resources
  add column if not exists resource_family_id uuid,
  add column if not exists resource_version integer not null default 1,
  add column if not exists supersedes_resource_id uuid references public.learning_resources(id) on delete restrict,
  add column if not exists lifecycle_state text not null default 'active',
  add column if not exists replacement_note text not null default '',
  add column if not exists caption_mode text not null default 'not_reviewed',
  add column if not exists caption_language text not null default 'en',
  add column if not exists caption_url text,
  add column if not exists transcript_text text not null default '',
  add column if not exists accessibility_notes text not null default '',
  add column if not exists is_decorative boolean not null default false,
  add column if not exists accessibility_status text not null default 'needs_review';

update public.learning_resources
set resource_family_id=id
where resource_family_id is null;

alter table public.learning_resources
  alter column resource_family_id set not null,
  add constraint learning_resources_version_positive_check
    check (resource_version>0),
  add constraint learning_resources_lifecycle_state_check
    check (lifecycle_state in ('active','replaced','retired')),
  add constraint learning_resources_caption_mode_check
    check (caption_mode in ('not_reviewed','provider_captions','transcript','webvtt','not_required')),
  add constraint learning_resources_caption_language_check
    check (caption_language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  add constraint learning_resources_caption_url_check
    check (
      caption_url is null
      or (
        char_length(caption_url)<=2048
        and caption_url ~* '^https://[^[:space:]]+$'
      )
    ),
  add constraint learning_resources_transcript_length_check
    check (char_length(transcript_text)<=100000),
  add constraint learning_resources_accessibility_notes_length_check
    check (char_length(accessibility_notes)<=5000),
  add constraint learning_resources_accessibility_status_check
    check (accessibility_status in ('needs_review','ready')),
  add constraint learning_resources_replacement_shape_check
    check (
      supersedes_resource_id is null
      or (
        supersedes_resource_id<>id
        and char_length(trim(replacement_note)) between 4 and 1000
      )
    );

create unique index learning_resources_family_version_uidx
  on public.learning_resources (resource_family_id,resource_version);
create index learning_resources_supersedes_idx
  on public.learning_resources (supersedes_resource_id)
  where supersedes_resource_id is not null;
create index learning_resources_active_course_idx
  on public.learning_resources (course_id,target_kind,target_key,created_at)
  where lifecycle_state='active' and deleted_at is null;

create or replace function private.media_accessibility_status(
  p_resource_type text,
  p_alt_text text,
  p_is_decorative boolean,
  p_caption_mode text,
  p_caption_url text,
  p_transcript_text text,
  p_accessibility_notes text
)
returns text
language sql
immutable
set search_path=''
as $$
  select case
    when p_resource_type='image'
      and (coalesce(p_is_decorative,false) or char_length(trim(coalesce(p_alt_text,'')))>=4)
      then 'ready'
    when p_resource_type='image' then 'needs_review'
    when p_resource_type='youtube'
      and p_caption_mode='provider_captions' then 'ready'
    when p_resource_type in ('youtube','video','audio')
      and p_caption_mode='transcript'
      and char_length(trim(coalesce(p_transcript_text,'')))>=20 then 'ready'
    when p_resource_type in ('youtube','video','audio')
      and p_caption_mode='webvtt'
      and coalesce(p_caption_url,'') ~* '^https://[^[:space:]]+$' then 'ready'
    when p_resource_type in ('youtube','video','audio')
      and p_caption_mode='not_required'
      and char_length(trim(coalesce(p_accessibility_notes,'')))>=20 then 'ready'
    when p_resource_type in ('youtube','video','audio') then 'needs_review'
    else 'ready'
  end
$$;

revoke all on function private.media_accessibility_status(text,text,boolean,text,text,text,text)
from public,anon,authenticated;

update public.learning_resources
set accessibility_status=private.media_accessibility_status(
  resource_type,alt_text,is_decorative,caption_mode,caption_url,
  transcript_text,accessibility_notes
);

create or replace function private.guard_learning_resource_version_identity()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(current_setting('app.media_version_write',true),'')<>'allowed' then
    raise exception 'Media version identity is server governed';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_learning_resource_version_identity()
from public,anon,authenticated;

drop trigger if exists learning_resources_version_identity_guard
on public.learning_resources;
create trigger learning_resources_version_identity_guard
before update of resource_family_id,resource_version,supersedes_resource_id,lifecycle_state
on public.learning_resources
for each row execute function private.guard_learning_resource_version_identity();

create or replace function private.guard_learning_resource_media()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_previous public.learning_resources%rowtype;
begin
  if new.storage_mode='external' then
    if new.external_url is null
       or char_length(new.external_url)>2048
       or new.external_url !~* '^https://[^[:space:]]+$' then
      raise exception 'External learning resources require a valid HTTPS address';
    end if;
  end if;
  if new.resource_type='youtube'
     and private.youtube_video_id(new.external_url) is null then
    raise exception 'YouTube resources require a supported public video address';
  end if;
  if new.target_kind in ('lesson','assignment')
     and char_length(trim(coalesce(new.target_key,'')))=0 then
    raise exception 'Lesson and assignment resources require an exact target';
  end if;
  if new.target_kind='personal' and new.visibility<>'private' then
    raise exception 'Personal learning resources must remain private';
  end if;
  if new.caption_mode='provider_captions' and new.resource_type<>'youtube' then
    raise exception 'Provider caption verification is only valid for YouTube resources';
  end if;
  if new.caption_mode='webvtt' and new.caption_url is null then
    raise exception 'WebVTT captions require a valid HTTPS caption address';
  end if;

  if tg_op='INSERT' then
    new.course_publication_state:='draft';
    new.course_publication_id:=null;
    new.course_publication_version:=null;
    new.course_published_at:=null;
    new.lifecycle_state:='active';
    if new.supersedes_resource_id is null then
      new.resource_family_id:=new.id;
      new.resource_version:=1;
      new.replacement_note:='';
    else
      select * into v_previous
      from public.learning_resources resource
      where resource.id=new.supersedes_resource_id
      for update;
      if not found
         or v_previous.lifecycle_state<>'active'
         or v_previous.owner_id<>new.owner_id
         or v_previous.course_id is distinct from new.course_id
         or v_previous.assignment_id is distinct from new.assignment_id
         or v_previous.placement<>new.placement
         or v_previous.target_kind<>new.target_kind
         or v_previous.target_key is distinct from new.target_key then
        raise exception 'Replacement media must match one active owned resource and its exact course location';
      end if;
      if char_length(trim(coalesce(new.replacement_note,'')))<4 then
        raise exception 'Replacement media requires a short change note';
      end if;
      new.resource_family_id:=v_previous.resource_family_id;
      new.resource_version:=v_previous.resource_version+1;
      perform set_config('app.media_version_write','allowed',true);
      update public.learning_resources
      set lifecycle_state='replaced'
      where id=v_previous.id;
      perform set_config('app.media_version_write','',true);
    end if;
  else
    if new.resource_family_id is distinct from old.resource_family_id
       or new.resource_version is distinct from old.resource_version
       or new.supersedes_resource_id is distinct from old.supersedes_resource_id then
      raise exception 'Create a replacement instead of rewriting media version identity';
    end if;
    if row(
      new.title,new.description,new.placement,new.target_kind,new.target_key,
      new.storage_mode,new.external_url,new.secure_file_id,new.mime_type,
      new.alt_text,new.source_label,new.license_label,new.visibility,new.metadata,
      new.caption_mode,new.caption_language,new.caption_url,new.transcript_text,
      new.accessibility_notes,new.is_decorative
    ) is distinct from row(
      old.title,old.description,old.placement,old.target_kind,old.target_key,
      old.storage_mode,old.external_url,old.secure_file_id,old.mime_type,
      old.alt_text,old.source_label,old.license_label,old.visibility,old.metadata,
      old.caption_mode,old.caption_language,old.caption_url,old.transcript_text,
      old.accessibility_notes,old.is_decorative
    ) then
      new.course_publication_state:='draft';
      new.course_publication_id:=null;
      new.course_publication_version:=null;
      new.course_published_at:=null;
    end if;
  end if;

  new.accessibility_status:=private.media_accessibility_status(
    new.resource_type,new.alt_text,new.is_decorative,new.caption_mode,
    new.caption_url,new.transcript_text,new.accessibility_notes
  );
  return new;
end;
$$;

revoke all on function private.guard_learning_resource_media()
from public,anon,authenticated;

drop trigger if exists learning_resources_media_guard
on public.learning_resources;
create trigger learning_resources_media_guard
before insert or update of
  title,description,placement,target_kind,target_key,storage_mode,external_url,
  secure_file_id,mime_type,alt_text,source_label,license_label,visibility,metadata,
  supersedes_resource_id,replacement_note,caption_mode,caption_language,
  caption_url,transcript_text,accessibility_notes,is_decorative
on public.learning_resources
for each row execute function private.guard_learning_resource_media();

alter table public.course_publication_resources
  add column if not exists resource_family_id uuid,
  add column if not exists resource_version integer not null default 1,
  add column if not exists supersedes_resource_id uuid,
  add column if not exists caption_mode text not null default 'not_reviewed',
  add column if not exists caption_language text not null default 'en',
  add column if not exists caption_url text,
  add column if not exists transcript_text text not null default '',
  add column if not exists accessibility_notes text not null default '',
  add column if not exists is_decorative boolean not null default false,
  add column if not exists accessibility_status text not null default 'needs_review';

update public.course_publication_resources snapshot
set resource_family_id=coalesce(resource.resource_family_id,snapshot.resource_id,snapshot.id),
    resource_version=coalesce(resource.resource_version,1),
    supersedes_resource_id=resource.supersedes_resource_id,
    caption_mode=coalesce(resource.caption_mode,'not_reviewed'),
    caption_language=coalesce(resource.caption_language,'en'),
    caption_url=resource.caption_url,
    transcript_text=coalesce(resource.transcript_text,''),
    accessibility_notes=coalesce(resource.accessibility_notes,''),
    is_decorative=coalesce(resource.is_decorative,false),
    accessibility_status=coalesce(resource.accessibility_status,'needs_review')
from public.learning_resources resource
where resource.id=snapshot.resource_id;

update public.course_publication_resources
set resource_family_id=coalesce(resource_family_id,resource_id,id)
where resource_family_id is null;

alter table public.course_publication_resources
  alter column resource_family_id set not null,
  add constraint course_publication_resources_media_version_check
    check (resource_version>0),
  add constraint course_publication_resources_caption_mode_check
    check (caption_mode in ('not_reviewed','provider_captions','transcript','webvtt','not_required')),
  add constraint course_publication_resources_accessibility_status_check
    check (accessibility_status in ('needs_review','ready'));

create index course_publication_resources_family_idx
  on public.course_publication_resources (resource_family_id,resource_version);

create or replace function private.snapshot_course_publication_resources(
  p_publication_id uuid,
  p_version_number integer,
  p_manifest jsonb,
  p_published_by uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_course_id uuid;
begin
  select publication.course_id into v_course_id
  from public.course_publications publication
  where publication.id=p_publication_id;
  if v_course_id is null then
    raise exception 'Course publication is unavailable for resource snapshotting';
  end if;

  if exists (
    select 1
    from public.learning_resources resource
    where resource.course_id=v_course_id
      and resource.deleted_at is null
      and resource.lifecycle_state='active'
      and resource.visibility in ('course','public','publisher')
      and resource.target_kind='lesson'
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_manifest->'paths','[]'::jsonb)) path,
             jsonb_array_elements(coalesce(path->'nodes','[]'::jsonb)) lesson
        where lesson->>'id'=resource.target_key
      )
  ) then
    raise exception 'A course resource targets a lesson that is not in this publication version';
  end if;

  if exists (
    select 1
    from public.learning_resources resource
    where resource.course_id=v_course_id
      and resource.deleted_at is null
      and resource.lifecycle_state='active'
      and resource.visibility in ('course','public','publisher')
      and resource.target_kind='assignment'
      and not exists (
        select 1 from public.assignments assignment
        where assignment.course_id=v_course_id
          and assignment.id::text=resource.target_key
      )
  ) then
    raise exception 'A course resource targets an assignment that is not part of this course';
  end if;

  if exists (
    select 1
    from public.learning_resources resource
    where resource.course_id=v_course_id
      and resource.deleted_at is null
      and resource.lifecycle_state='active'
      and resource.visibility in ('course','public','publisher')
      and resource.resource_type in ('youtube','video','audio','image')
      and resource.accessibility_status<>'ready'
  ) then
    raise exception 'Every published media resource requires completed accessibility review';
  end if;

  delete from public.course_publication_resources snapshot
  where snapshot.publication_id=p_publication_id
    and snapshot.version_number=p_version_number;

  insert into public.course_publication_resources (
    publication_id,version_number,course_id,resource_id,resource_type,title,
    description,placement,target_kind,target_key,embed_provider,embed_key,
    external_url,secure_file_id,mime_type,alt_text,source_label,license_label,
    position,published_by,published_at,resource_family_id,resource_version,
    supersedes_resource_id,caption_mode,caption_language,caption_url,
    transcript_text,accessibility_notes,is_decorative,accessibility_status
  )
  select
    p_publication_id,p_version_number,v_course_id,resource.id,
    resource.resource_type,resource.title,left(resource.description,5000),
    resource.placement,resource.target_kind,resource.target_key,
    case
      when resource.resource_type='youtube' then 'youtube'
      when resource.resource_type='video' and resource.secure_file_id is not null then 'secure_video'
      when resource.resource_type='audio' and resource.secure_file_id is not null then 'secure_audio'
      when resource.resource_type='image' and resource.secure_file_id is not null then 'secure_image'
      when resource.resource_type='quote' then 'quote'
      when resource.resource_type='link' then 'web'
      else 'file'
    end,
    case when resource.resource_type='youtube'
      then private.youtube_video_id(resource.external_url) else null end,
    resource.external_url,resource.secure_file_id,resource.mime_type,
    resource.alt_text,resource.source_label,resource.license_label,
    greatest(0,least(10000,coalesce(
      case when resource.metadata->>'position' ~ '^[0-9]+$'
        then (resource.metadata->>'position')::integer end,
      0
    ))),
    p_published_by,now(),resource.resource_family_id,resource.resource_version,
    resource.supersedes_resource_id,resource.caption_mode,
    resource.caption_language,resource.caption_url,left(resource.transcript_text,100000),
    resource.accessibility_notes,resource.is_decorative,resource.accessibility_status
  from public.learning_resources resource
  where resource.course_id=v_course_id
    and resource.deleted_at is null
    and resource.lifecycle_state='active'
    and resource.visibility in ('course','public','publisher')
    and resource.target_kind<>'personal'
    and resource.storage_mode<>'device'
    and (resource.secure_file_id is null or resource.security_status='clean');

  update public.learning_resources resource
  set course_publication_state='draft',
      course_publication_id=null,
      course_publication_version=null,
      course_published_at=null
  where resource.course_id=v_course_id
    and resource.course_publication_state='published';

  update public.learning_resources resource
  set course_publication_state='published',
      course_publication_id=p_publication_id,
      course_publication_version=p_version_number,
      course_published_at=now()
  where resource.id in (
    select snapshot.resource_id
    from public.course_publication_resources snapshot
    where snapshot.publication_id=p_publication_id
      and snapshot.version_number=p_version_number
      and snapshot.resource_id is not null
  );
end;
$$;

revoke all on function private.snapshot_course_publication_resources(uuid,integer,jsonb,uuid)
from public,anon,authenticated;

create table public.media_viewing_progress (
  id uuid primary key default gen_random_uuid(),
  publication_resource_id uuid not null references public.course_publication_resources(id) on delete cascade,
  publication_id uuid not null references public.course_publications(id) on delete cascade,
  version_number integer not null check (version_number>0),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started','started','in_progress','completed')),
  last_position_seconds numeric(12,3) not null default 0
    check (last_position_seconds between 0 and 172800),
  max_position_seconds numeric(12,3) not null default 0
    check (max_position_seconds between 0 and 172800),
  duration_seconds numeric(12,3)
    check (duration_seconds is null or duration_seconds between 1 and 172800),
  percent_complete numeric(5,2) not null default 0
    check (percent_complete between 0 and 100),
  transcript_opened boolean not null default false,
  captions_enabled boolean not null default false,
  event_count integer not null default 0 check (event_count between 0 and 100000),
  completion_basis text
    check (completion_basis is null or completion_basis in ('player_ended','threshold')),
  started_at timestamptz,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_resource_id,user_id)
);

create index media_viewing_progress_user_idx
  on public.media_viewing_progress (user_id,publication_id,updated_at desc);
create index media_viewing_progress_course_idx
  on public.media_viewing_progress (course_id,version_number,publication_resource_id,status);
create index media_viewing_progress_publication_idx
  on public.media_viewing_progress (publication_id,version_number);

alter table public.media_viewing_progress enable row level security;
revoke all on public.media_viewing_progress from anon,authenticated;
grant select,insert,update,delete on public.media_viewing_progress to service_role;

create policy media_viewing_progress_no_direct_browser_access
on public.media_viewing_progress
for all to authenticated
using (false)
with check (false);

create or replace function public.record_course_media_progress(
  p_publication_resource_id uuid,
  p_event_type text,
  p_position_seconds numeric default null,
  p_duration_seconds numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_snapshot public.course_publication_resources%rowtype;
  v_existing public.media_viewing_progress%rowtype;
  v_position numeric(12,3);
  v_duration numeric(12,3);
  v_max_position numeric(12,3);
  v_percent numeric(5,2);
  v_status text;
  v_completed_at timestamptz;
  v_basis text;
  v_row public.media_viewing_progress%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('started','progress','paused','completed','transcript_opened','captions_enabled') then
    raise exception 'Unsupported media evidence event';
  end if;
  if p_position_seconds is not null
     and (p_position_seconds<0 or p_position_seconds>172800) then
    raise exception 'Media position is outside the supported range';
  end if;
  if p_duration_seconds is not null
     and (p_duration_seconds<1 or p_duration_seconds>172800) then
    raise exception 'Media duration is outside the supported range';
  end if;

  select snapshot.* into v_snapshot
  from public.course_publication_resources snapshot
  join public.course_publications publication
    on publication.id=snapshot.publication_id
   and publication.status='published'
   and publication.current_version=snapshot.version_number
  where snapshot.id=p_publication_resource_id;

  if not found or not private.can_access_course(v_snapshot.course_id) then
    raise exception 'Published media is unavailable or access is denied';
  end if;
  if not exists (
    select 1
    from public.course_memberships membership
    where membership.course_id=v_snapshot.course_id
      and membership.user_id=v_user_id
      and membership.role='learner'
      and (membership.access_expires_at is null or membership.access_expires_at>now())
  ) then
    raise exception 'Active learner enrollment is required for viewing evidence';
  end if;

  select * into v_existing
  from public.media_viewing_progress progress
  where progress.publication_resource_id=v_snapshot.id
    and progress.user_id=v_user_id
  for update;

  v_position:=least(172800,greatest(0,coalesce(p_position_seconds,v_existing.last_position_seconds,0)));
  v_duration:=case
    when greatest(coalesce(p_duration_seconds,0),coalesce(v_existing.duration_seconds,0))>0
      then greatest(coalesce(p_duration_seconds,0),coalesce(v_existing.duration_seconds,0))
    else null
  end;
  v_max_position:=greatest(coalesce(v_existing.max_position_seconds,0),v_position);
  v_percent:=greatest(
    coalesce(v_existing.percent_complete,0),
    case when v_duration is not null
      then least(100,round((v_max_position/v_duration)*100,2))
      else 0 end
  );
  v_status:=case
    when coalesce(v_existing.status,'')='completed' then 'completed'
    when p_event_type='completed' and v_duration is not null and v_percent>=90 then 'completed'
    when p_event_type in ('progress','paused') or v_percent>0 then 'in_progress'
    when p_event_type='started' then 'started'
    else coalesce(v_existing.status,'not_started')
  end;
  v_completed_at:=case
    when v_status='completed' then coalesce(v_existing.completed_at,now())
    else null
  end;
  v_basis:=case
    when coalesce(v_existing.status,'')='completed' then v_existing.completion_basis
    when v_status='completed' and p_event_type='completed' then 'player_ended'
    when v_status='completed' then 'threshold'
    else null
  end;

  insert into public.media_viewing_progress (
    publication_resource_id,publication_id,version_number,course_id,user_id,
    status,last_position_seconds,max_position_seconds,duration_seconds,
    percent_complete,transcript_opened,captions_enabled,event_count,
    completion_basis,started_at,last_viewed_at,completed_at
  ) values (
    v_snapshot.id,v_snapshot.publication_id,v_snapshot.version_number,
    v_snapshot.course_id,v_user_id,v_status,v_position,v_max_position,
    v_duration,v_percent,p_event_type='transcript_opened',
    p_event_type='captions_enabled',1,v_basis,
    case when p_event_type in ('started','progress','paused','completed') then now() else null end,
    case when p_event_type in ('started','progress','paused','completed') then now() else null end,
    v_completed_at
  )
  on conflict (publication_resource_id,user_id) do update
  set status=excluded.status,
      last_position_seconds=excluded.last_position_seconds,
      max_position_seconds=excluded.max_position_seconds,
      duration_seconds=excluded.duration_seconds,
      percent_complete=excluded.percent_complete,
      transcript_opened=public.media_viewing_progress.transcript_opened or excluded.transcript_opened,
      captions_enabled=public.media_viewing_progress.captions_enabled or excluded.captions_enabled,
      event_count=least(100000,public.media_viewing_progress.event_count+1),
      completion_basis=coalesce(public.media_viewing_progress.completion_basis,excluded.completion_basis),
      started_at=coalesce(public.media_viewing_progress.started_at,excluded.started_at),
      last_viewed_at=coalesce(excluded.last_viewed_at,public.media_viewing_progress.last_viewed_at),
      completed_at=coalesce(public.media_viewing_progress.completed_at,excluded.completed_at),
      updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'progress',jsonb_build_object(
      'status',v_row.status,
      'last_position_seconds',v_row.last_position_seconds,
      'max_position_seconds',v_row.max_position_seconds,
      'duration_seconds',v_row.duration_seconds,
      'percent_complete',v_row.percent_complete,
      'transcript_opened',v_row.transcript_opened,
      'captions_enabled',v_row.captions_enabled,
      'completed_at',v_row.completed_at,
      'updated_at',v_row.updated_at
    ),
    'evidence_policy',jsonb_build_object(
      'aggregateOnly',true,
      'provesLearning',false,
      'gradingUse','prohibited_without_separate_assessment'
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
    'resources',coalesce((
      select jsonb_agg(jsonb_build_object(
        'publication_resource_id',snapshot.id,
        'resource_id',snapshot.resource_id,
        'resource_family_id',snapshot.resource_family_id,
        'resource_version',snapshot.resource_version,
        'title',snapshot.title,
        'resource_type',snapshot.resource_type,
        'started_learners',coalesce(summary.started_learners,0),
        'completed_learners',coalesce(summary.completed_learners,0),
        'transcript_learners',coalesce(summary.transcript_learners,0),
        'caption_learners',coalesce(summary.caption_learners,0),
        'average_percent',coalesce(summary.average_percent,0),
        'last_activity_at',summary.last_activity_at
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
      ) summary on true
      where snapshot.publication_id=v_publication.id
        and snapshot.version_number=v_publication.current_version
    ),'[]'::jsonb),
    'evidence_policy',jsonb_build_object(
      'individualPlaybackLogExposed',false,
      'ipOrDeviceDataCollected',false,
      'provesLearning',false,
      'gradingUse','Pair with a separate assessment before making academic decisions.'
    )
  );
end;
$$;

create or replace function public.retire_learning_resource(
  p_resource_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_resource public.learning_resources%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(p_reason,'')))<4 then
    raise exception 'Retiring media requires a short reason';
  end if;
  select * into v_resource
  from public.learning_resources resource
  where resource.id=p_resource_id
    and resource.deleted_at is null
  for update;
  if not found
     or v_resource.owner_id<>v_user_id
     or (
       v_resource.course_id is not null
       and not private.can_manage_course(v_resource.course_id)
     ) then
    raise exception 'The resource is unavailable or cannot be managed';
  end if;
  perform set_config('app.media_version_write','allowed',true);
  update public.learning_resources
  set lifecycle_state='retired',
      replacement_note=left(trim(p_reason),1000),
      course_publication_state='draft',
      course_publication_id=null,
      course_publication_version=null,
      course_published_at=null
  where id=v_resource.id;
  perform set_config('app.media_version_write','',true);
  return jsonb_build_object('id',v_resource.id,'status','retired');
end;
$$;

create or replace function public.get_published_course_resources(
  p_publication_id uuid
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
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_publication
  from public.course_publications publication
  where publication.id=p_publication_id
    and publication.status='published';
  if not found or not private.can_access_course(v_publication.course_id) then
    raise exception 'Published course resources are unavailable or access is denied';
  end if;
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
          ) as viewing_progress
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
      'progressEvidence','aggregate_not_learning_proof'
    )
  );
end;
$$;

revoke all on function public.record_course_media_progress(uuid,text,numeric,numeric)
from public,anon;
revoke all on function public.get_course_media_evidence(uuid)
from public,anon;
revoke all on function public.retire_learning_resource(uuid,text)
from public,anon;
grant execute on function public.record_course_media_progress(uuid,text,numeric,numeric)
to authenticated;
grant execute on function public.get_course_media_evidence(uuid)
to authenticated;
grant execute on function public.retire_learning_resource(uuid,text)
to authenticated;
