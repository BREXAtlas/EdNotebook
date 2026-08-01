-- Govern professor-to-student media publication and private student resources.
-- Course resources remain draft until the professor publishes a course-package
-- version. Learners receive the immutable resource snapshot for that exact
-- version; personal learner links remain private to their owner.

alter table public.learning_resources
  add column if not exists target_kind text not null default 'course',
  add column if not exists target_key text,
  add column if not exists course_publication_state text not null default 'draft',
  add column if not exists course_publication_id uuid references public.course_publications(id) on delete set null,
  add column if not exists course_publication_version integer,
  add column if not exists course_published_at timestamptz;

update public.learning_resources
set target_kind=case
      when placement='assignment' and assignment_id is not null then 'assignment'
      when placement='private-vault' or (course_id is not null and visibility='private' and assignment_id is null) then 'personal'
      else 'course'
    end,
    target_key=case
      when placement='assignment' and assignment_id is not null then assignment_id::text
      else null
    end
where target_kind='course' and target_key is null;

alter table public.learning_resources
  add constraint learning_resources_target_kind_check
    check (target_kind in ('course','lesson','assignment','personal')),
  add constraint learning_resources_target_shape_check
    check (
      (target_kind in ('course','personal') and target_key is null)
      or (target_kind in ('lesson','assignment') and char_length(trim(coalesce(target_key,''))) between 1 and 160)
    ),
  add constraint learning_resources_personal_visibility_check
    check (target_kind<>'personal' or visibility='private'),
  add constraint learning_resources_course_publication_state_check
    check (course_publication_state in ('draft','published','retired')),
  add constraint learning_resources_course_publication_shape_check
    check (
      (course_publication_state<>'published'
        and course_publication_id is null
        and course_publication_version is null
        and course_published_at is null)
      or
      (course_publication_state='published'
        and course_publication_id is not null
        and course_publication_version is not null
        and course_publication_version>0
        and course_published_at is not null)
    );

create index if not exists learning_resources_course_publication_state_idx
  on public.learning_resources (course_id,course_publication_state,placement,target_kind,target_key,created_at);
create index if not exists learning_resources_course_publication_id_idx
  on public.learning_resources (course_publication_id,course_publication_version)
  where course_publication_id is not null;
create index if not exists learning_resources_owner_personal_idx
  on public.learning_resources (owner_id,course_id,created_at desc)
  where target_kind='personal' and deleted_at is null;

create table public.course_publication_resources (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.course_publications(id) on delete cascade,
  version_number integer not null check (version_number>0),
  course_id uuid not null references public.courses(id) on delete cascade,
  resource_id uuid references public.learning_resources(id) on delete set null,
  resource_type text not null check (resource_type in ('file','image','link','youtube','quote','book','slide_deck','audio','video','dataset','other')),
  title text not null check (char_length(title) between 1 and 220),
  description text not null default '',
  placement text not null,
  target_kind text not null check (target_kind in ('course','lesson','assignment')),
  target_key text,
  embed_provider text not null check (embed_provider in ('youtube','secure_video','secure_audio','secure_image','web','quote','file')),
  embed_key text,
  external_url text,
  secure_file_id uuid references public.secure_file_objects(id) on delete set null,
  mime_type text,
  alt_text text,
  source_label text,
  license_label text,
  position integer not null default 0 check (position between 0 and 10000),
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (publication_id,version_number,resource_id),
  check (
    (target_kind='course' and target_key is null)
    or (target_kind in ('lesson','assignment') and char_length(trim(coalesce(target_key,''))) between 1 and 160)
  ),
  check (embed_provider<>'youtube' or embed_key ~ '^[A-Za-z0-9_-]{11}$')
);

create index course_publication_resources_version_idx
  on public.course_publication_resources (publication_id,version_number,placement,position,published_at);
create index course_publication_resources_target_idx
  on public.course_publication_resources (publication_id,version_number,target_kind,target_key,position);
create index course_publication_resources_course_idx
  on public.course_publication_resources (course_id);
create index course_publication_resources_resource_idx
  on public.course_publication_resources (resource_id)
  where resource_id is not null;
create index course_publication_resources_secure_file_idx
  on public.course_publication_resources (secure_file_id)
  where secure_file_id is not null;

alter table public.course_publication_resources enable row level security;
revoke all on public.course_publication_resources from anon,authenticated;
grant select,insert,update,delete on public.course_publication_resources to service_role;

create policy course_publication_resources_no_direct_browser_access
on public.course_publication_resources
for all to authenticated
using (false)
with check (false);

create or replace function private.youtube_video_id(p_url text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  v_url text := trim(coalesce(p_url,''));
  v_match text[];
begin
  v_match:=regexp_match(v_url,'^https://(?:www\.)?youtu\.be/([A-Za-z0-9_-]{11})(?:[?&#/]|$)','i');
  if v_match is not null then return v_match[1]; end if;
  v_match:=regexp_match(v_url,'^https://(?:www\.)?youtube\.com/watch\?(?:[^# ]*&)?v=([A-Za-z0-9_-]{11})(?:[&#]|$)','i');
  if v_match is not null then return v_match[1]; end if;
  v_match:=regexp_match(v_url,'^https://(?:www\.)?youtube\.com/(?:embed|shorts|live)/([A-Za-z0-9_-]{11})(?:[?&#/]|$)','i');
  if v_match is not null then return v_match[1]; end if;
  v_match:=regexp_match(v_url,'^https://(?:www\.)?youtube-nocookie\.com/embed/([A-Za-z0-9_-]{11})(?:[?&#/]|$)','i');
  if v_match is not null then return v_match[1]; end if;
  return null;
end;
$$;

revoke all on function private.youtube_video_id(text)
from public,anon,authenticated;

create or replace function private.guard_learning_resource_media()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
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

  if tg_op='INSERT' then
    new.course_publication_state:='draft';
    new.course_publication_id:=null;
    new.course_publication_version:=null;
    new.course_published_at:=null;
  elsif row(
    new.title,new.description,new.placement,new.target_kind,new.target_key,
    new.storage_mode,new.external_url,new.secure_file_id,new.mime_type,
    new.alt_text,new.source_label,new.license_label,new.visibility,new.metadata
  ) is distinct from row(
    old.title,old.description,old.placement,old.target_kind,old.target_key,
    old.storage_mode,old.external_url,old.secure_file_id,old.mime_type,
    old.alt_text,old.source_label,old.license_label,old.visibility,old.metadata
  ) then
    new.course_publication_state:='draft';
    new.course_publication_id:=null;
    new.course_publication_version:=null;
    new.course_published_at:=null;
  end if;
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
  secure_file_id,mime_type,alt_text,source_label,license_label,visibility,metadata
on public.learning_resources
for each row execute function private.guard_learning_resource_media();

drop policy if exists learning_resources_select on public.learning_resources;
create policy learning_resources_select on public.learning_resources
for select to authenticated
using (
  deleted_at is null
  and (
    owner_id=(select auth.uid())
    or (
      assignment_id is not null
      and private.can_manage_assignment(assignment_id)
      and (secure_file_id is null or security_status='clean')
    )
    or (
      course_id is not null
      and visibility in ('course','public','publisher')
      and (secure_file_id is null or security_status='clean')
      and (
        private.can_manage_course(course_id)
        or (
          private.can_access_course(course_id)
          and (
            course_publication_state='published'
            or (
              publication_id is not null
              and private.can_access_publication(publication_id,(select auth.uid()))
            )
          )
        )
      )
    )
  )
);

drop policy if exists learning_resources_insert on public.learning_resources;
create policy learning_resources_insert on public.learning_resources
for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and course_publication_state='draft'
  and course_publication_id is null
  and course_publication_version is null
  and course_published_at is null
  and (course_id is null or private.can_access_course(course_id))
  and (assignment_id is null or private.can_access_assignment(assignment_id))
  and (secure_file_id is null or private.can_access_secure_file(secure_file_id,(select auth.uid())))
  and (publication_id is null or private.can_access_publication(publication_id,(select auth.uid())))
  and (
    visibility='private'
    or (
      course_id is not null
      and private.can_manage_course(course_id)
      and visibility in ('course','public','publisher')
      and target_kind<>'personal'
    )
  )
);

drop policy if exists learning_resources_update on public.learning_resources;
create policy learning_resources_update on public.learning_resources
for update to authenticated
using (
  owner_id=(select auth.uid())
  or (assignment_id is not null and private.can_manage_assignment(assignment_id))
  or (course_id is not null and private.can_manage_course(course_id))
)
with check (
  (publication_id is null or private.can_access_publication(publication_id,(select auth.uid())))
  and (
    (
      course_id is not null
      and private.can_manage_course(course_id)
      and target_kind<>'personal'
      and visibility in ('course','public','publisher')
      and course_publication_state='draft'
      and course_publication_id is null
      and course_publication_version is null
      and course_published_at is null
    )
    or (
      owner_id=(select auth.uid())
      and visibility='private'
      and course_publication_state='draft'
      and course_publication_id is null
      and course_publication_version is null
      and course_published_at is null
    )
  )
);

drop policy if exists learning_resources_delete on public.learning_resources;
create policy learning_resources_delete on public.learning_resources
for delete to authenticated
using (
  secure_file_id is null
  and (
    owner_id=(select auth.uid())
    or (
      assignment_id is not null
      and target_kind<>'personal'
      and private.can_manage_assignment(assignment_id)
    )
    or (
      course_id is not null
      and target_kind<>'personal'
      and visibility in ('course','public','publisher')
      and private.can_manage_course(course_id)
    )
  )
);

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

  delete from public.course_publication_resources snapshot
  where snapshot.publication_id=p_publication_id
    and snapshot.version_number=p_version_number;

  insert into public.course_publication_resources (
    publication_id,version_number,course_id,resource_id,resource_type,title,
    description,placement,target_kind,target_key,embed_provider,embed_key,
    external_url,secure_file_id,mime_type,alt_text,source_label,license_label,
    position,published_by,published_at
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
    p_published_by,now()
  from public.learning_resources resource
  where resource.course_id=v_course_id
    and resource.deleted_at is null
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

create or replace function private.snapshot_course_publication_resources_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform private.snapshot_course_publication_resources(
    new.publication_id,new.version_number,new.manifest,new.published_by
  );
  return new;
end;
$$;

revoke all on function private.snapshot_course_publication_resources_trigger()
from public,anon,authenticated;

drop trigger if exists course_publication_versions_snapshot_resources
on public.course_publication_versions;
create trigger course_publication_versions_snapshot_resources
after insert on public.course_publication_versions
for each row execute function private.snapshot_course_publication_resources_trigger();

do $$
declare
  version_record record;
begin
  for version_record in
    select publication.id as publication_id,publication.current_version,
           version.manifest,version.published_by
    from public.course_publications publication
    join public.course_publication_versions version
      on version.publication_id=publication.id
     and version.version_number=publication.current_version
    where publication.status='published' and publication.current_version>0
  loop
    perform private.snapshot_course_publication_resources(
      version_record.publication_id,version_record.current_version,
      version_record.manifest,version_record.published_by
    );
  end loop;
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
          snapshot.license_label,snapshot.position,snapshot.published_at
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
      'personalResourcesPrivate',true
    )
  );
end;
$$;

create or replace function public.get_my_course_resources(
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
begin
  if v_user_id is null or not private.can_access_course(p_course_id) then
    raise exception 'Course resource access denied';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',resource.id,'resource_type',resource.resource_type,
      'title',resource.title,'description',resource.description,
      'placement',resource.placement,'target_kind',resource.target_kind,
      'external_url',resource.external_url,
      'embed_provider',case when resource.resource_type='youtube' then 'youtube' else 'web' end,
      'embed_key',private.youtube_video_id(resource.external_url),
      'created_at',resource.created_at
    ) order by resource.created_at desc)
    from public.learning_resources resource
    where resource.owner_id=v_user_id
      and resource.course_id=p_course_id
      and resource.target_kind='personal'
      and resource.visibility='private'
      and resource.deleted_at is null
  ),'[]'::jsonb);
end;
$$;

create or replace function public.save_my_course_link(
  p_course_id uuid,
  p_url text,
  p_title text,
  p_description text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_url text := trim(coalesce(p_url,''));
  v_video_id text;
  v_resource public.learning_resources%rowtype;
begin
  if v_user_id is null or not private.can_access_course(p_course_id) then
    raise exception 'Course resource access denied';
  end if;
  if char_length(v_url)>2048 or v_url !~* '^https://[^[:space:]]+$' then
    raise exception 'Use a complete HTTPS resource address';
  end if;
  if char_length(trim(coalesce(p_title,'')))<1 then
    raise exception 'Add a resource title';
  end if;
  if (
    select count(*) from public.learning_resources resource
    where resource.owner_id=v_user_id and resource.course_id=p_course_id
      and resource.target_kind='personal' and resource.deleted_at is null
  )>=100 then
    raise exception 'A course may contain up to 100 personal saved resources';
  end if;
  v_video_id:=private.youtube_video_id(v_url);
  insert into public.learning_resources (
    owner_id,course_id,resource_type,title,description,placement,storage_mode,
    external_url,visibility,target_kind,target_key,course_publication_state,
    security_status,metadata
  ) values (
    v_user_id,p_course_id,case when v_video_id is null then 'link' else 'youtube' end,
    left(trim(p_title),220),left(trim(coalesce(p_description,'')),1000),
    'course-library','external',v_url,'private','personal',null,'draft',
    'not_applicable',jsonb_build_object('format','EdNotebookPersonalResource/1.0')
  ) returning * into v_resource;
  insert into public.audit_events (
    actor_id,course_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,p_course_id,'course_resource.personal_saved','learning_resource',
    v_resource.id::text,jsonb_build_object(
      'resourceType',v_resource.resource_type,'provider',case when v_video_id is null then 'web' else 'youtube' end
    ),''
  );
  return jsonb_build_object(
    'id',v_resource.id,'resource_type',v_resource.resource_type,
    'title',v_resource.title,'description',v_resource.description,
    'placement',v_resource.placement,'target_kind',v_resource.target_kind,
    'external_url',v_resource.external_url,
    'embed_provider',case when v_video_id is null then 'web' else 'youtube' end,
    'embed_key',v_video_id,'created_at',v_resource.created_at
  );
end;
$$;

create or replace function public.delete_my_course_link(
  p_resource_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.learning_resources resource
  where resource.id=p_resource_id
    and resource.owner_id=v_user_id
    and resource.target_kind='personal'
    and resource.visibility='private'
    and resource.secure_file_id is null
  returning resource.course_id into v_course_id;
  if v_course_id is null then raise exception 'Personal course resource not found'; end if;
  insert into public.audit_events (
    actor_id,course_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_course_id,'course_resource.personal_removed','learning_resource',
    p_resource_id::text,'{}'::jsonb,''
  );
  return true;
end;
$$;

revoke all on function public.get_published_course_resources(uuid)
from public,anon;
revoke all on function public.get_my_course_resources(uuid)
from public,anon;
revoke all on function public.save_my_course_link(uuid,text,text,text)
from public,anon;
revoke all on function public.delete_my_course_link(uuid)
from public,anon;

grant execute on function public.get_published_course_resources(uuid)
to authenticated;
grant execute on function public.get_my_course_resources(uuid)
to authenticated;
grant execute on function public.save_my_course_link(uuid,text,text,text)
to authenticated;
grant execute on function public.delete_my_course_link(uuid)
to authenticated;
