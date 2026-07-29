-- Phase 5 course communication builds on learning_messages and
-- professor_announcements. It does not create a second chat/feed model.

alter table public.learning_messages
  add column if not exists message_kind text not null default 'course_note',
  add column if not exists parent_message_id uuid
    references public.learning_messages(id) on delete restrict;

alter table public.learning_messages
  drop constraint if exists learning_messages_message_kind_check;
alter table public.learning_messages
  add constraint learning_messages_message_kind_check
  check (message_kind in ('question','reply','course_note'));

alter table public.learning_messages
  drop constraint if exists learning_messages_thread_shape_check;
alter table public.learning_messages
  add constraint learning_messages_thread_shape_check
  check (
    (message_kind='reply' and parent_message_id is not null)
    or (message_kind in ('question','course_note') and parent_message_id is null)
  );

create index if not exists learning_messages_course_kind_created_idx
  on public.learning_messages(course_id,message_kind,created_at desc)
  where course_id is not null and recipient_id is null;
create index if not exists learning_messages_parent_idx
  on public.learning_messages(parent_message_id)
  where parent_message_id is not null;

create or replace function private.course_communication_body_is_safe(p_body text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    char_length(trim(coalesce(p_body,''))) between 1 and 5000
    and p_body !~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    and p_body !~* '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
    and p_body !~* '(api[ _-]?key|access[ _-]?token|password|secret)[[:space:]]*[:=]'
    and p_body !~* '(student[ _-]?id|grade|score|reward|points)[[:space:]]*[:=]';
$$;

revoke all on function private.course_communication_body_is_safe(text) from public;
grant execute on function private.course_communication_body_is_safe(text) to authenticated;

-- Replace the original identity trigger with a fail-closed guard. The
-- authenticated subject and profile label are derived on the server, while
-- reply and attachment references must remain inside the same course.
create or replace function private.set_learning_message_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'A signed-in course member is required';
  end if;
  if new.sender_id is not null and new.sender_id is distinct from (select auth.uid()) then
    raise exception 'The sender must match the authenticated user';
  end if;

  new.sender_id := (select auth.uid());
  select coalesce(nullif(trim(p.full_name),''),'Course member')
  into new.sender_label
  from public.profiles p
  where p.id=(select auth.uid());
  new.sender_label := coalesce(new.sender_label,'Course member');

  if not private.course_communication_body_is_safe(new.body) then
    raise exception 'Course communication cannot include account secrets, email addresses, private IDs, grade details, or reward details';
  end if;

  if new.course_id is null then
    if new.parent_message_id is not null or new.attachment_resource_id is not null then
      raise exception 'Course-less device notes cannot claim a cloud thread or resource';
    end if;
    new.message_kind := 'course_note';
    return new;
  end if;

  if new.message_kind in ('question','reply') and new.recipient_id is not null then
    raise exception 'Course questions and replies must be visible to the entire course';
  end if;

  if new.message_kind='reply' and not exists(
    select 1
    from public.learning_messages parent
    where parent.id=new.parent_message_id
      and parent.course_id=new.course_id
      and parent.recipient_id is null
      and parent.message_kind='question'
  ) then
    raise exception 'Replies must reference a visible root question in the same course';
  end if;

  if new.attachment_resource_id is not null and not exists(
    select 1
    from public.learning_resources resource
    where resource.id=new.attachment_resource_id
      and resource.course_id=new.course_id
      and resource.deleted_at is null
      and (
        resource.owner_id=(select auth.uid())
        or resource.visibility in ('course','public','publisher')
        or (
          resource.assignment_id is not null
          and private.can_manage_assignment(resource.assignment_id)
        )
      )
  ) then
    raise exception 'Attachment references must be authorized resources from the same course';
  end if;

  return new;
end;
$$;

revoke all on function private.set_learning_message_identity() from public;

create or replace function private.set_course_announcement_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_institution_id uuid;
  v_education_division text;
begin
  if (select auth.uid()) is null then
    raise exception 'A signed-in course manager is required';
  end if;
  if new.professor_id is not null and new.professor_id is distinct from (select auth.uid()) then
    raise exception 'The announcement author must match the authenticated user';
  end if;

  new.professor_id := (select auth.uid());

  if char_length(trim(coalesce(new.title,'')))>160
     or not private.course_communication_body_is_safe(new.title)
     or not private.course_communication_body_is_safe(new.body) then
    raise exception 'Course announcements cannot include account secrets, email addresses, private IDs, grade details, or reward details';
  end if;

  if new.audience='course' then
    select c.institution_id,c.education_division
    into v_institution_id,v_education_division
    from public.courses c
    where c.id=new.course_id;
    if not found or not private.can_manage_course(new.course_id) then
      raise exception 'Only a current course manager can publish this announcement';
    end if;
    new.institution_id := v_institution_id;
    new.education_division := v_education_division;
  end if;

  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_course_announcement_identity() from public;

drop trigger if exists professor_announcements_set_identity
on public.professor_announcements;
create trigger professor_announcements_set_identity
before insert or update of professor_id,course_id,audience,title,body,is_published
on public.professor_announcements
for each row execute function private.set_course_announcement_identity();

create table if not exists public.course_communication_reads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.learning_messages(id) on delete cascade,
  announcement_id uuid references public.professor_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint course_communication_reads_one_target_check
    check (num_nonnulls(message_id,announcement_id)=1)
);

create unique index if not exists course_communication_reads_message_unique
  on public.course_communication_reads(user_id,message_id)
  where message_id is not null;
create unique index if not exists course_communication_reads_announcement_unique
  on public.course_communication_reads(user_id,announcement_id)
  where announcement_id is not null;
create index if not exists course_communication_reads_course_user_idx
  on public.course_communication_reads(course_id,user_id,read_at desc);

create table if not exists public.course_communication_preferences (
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notify_announcements boolean not null default true,
  notify_replies boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(course_id,user_id)
);

create or replace function private.set_course_communication_read_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'A signed-in course member is required';
  end if;

  if new.message_id is not null then
    select m.course_id into v_course_id
    from public.learning_messages m
    where m.id=new.message_id and m.recipient_id is null;
  else
    select a.course_id into v_course_id
    from public.professor_announcements a
    where a.id=new.announcement_id
      and a.audience='course'
      and a.is_published;
  end if;

  if v_course_id is null or not private.can_access_course(v_course_id) then
    raise exception 'The communication item is not visible in a current course';
  end if;

  new.user_id := (select auth.uid());
  new.course_id := v_course_id;
  new.read_at := now();
  return new;
end;
$$;

revoke all on function private.set_course_communication_read_identity() from public;

drop trigger if exists course_communication_reads_set_identity
on public.course_communication_reads;
create trigger course_communication_reads_set_identity
before insert or update
on public.course_communication_reads
for each row execute function private.set_course_communication_read_identity();

create or replace function private.set_course_communication_preference_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not private.can_access_course(new.course_id) then
    raise exception 'A current course member is required';
  end if;
  new.user_id := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_course_communication_preference_identity() from public;

drop trigger if exists course_communication_preferences_set_identity
on public.course_communication_preferences;
create trigger course_communication_preferences_set_identity
before insert or update
on public.course_communication_preferences
for each row execute function private.set_course_communication_preference_identity();

alter table public.course_communication_reads enable row level security;
alter table public.course_communication_preferences enable row level security;

drop policy if exists course_communication_reads_select
on public.course_communication_reads;
create policy course_communication_reads_select
on public.course_communication_reads for select to authenticated
using (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_reads_insert
on public.course_communication_reads;
create policy course_communication_reads_insert
on public.course_communication_reads for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_reads_update
on public.course_communication_reads;
create policy course_communication_reads_update
on public.course_communication_reads for update to authenticated
using (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
)
with check (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_reads_delete
on public.course_communication_reads;
create policy course_communication_reads_delete
on public.course_communication_reads for delete to authenticated
using (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_preferences_select
on public.course_communication_preferences;
create policy course_communication_preferences_select
on public.course_communication_preferences for select to authenticated
using (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_preferences_insert
on public.course_communication_preferences;
create policy course_communication_preferences_insert
on public.course_communication_preferences for insert to authenticated
with check (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

drop policy if exists course_communication_preferences_update
on public.course_communication_preferences;
create policy course_communication_preferences_update
on public.course_communication_preferences for update to authenticated
using (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
)
with check (
  user_id=(select auth.uid())
  and private.can_access_course(course_id)
);

grant select,insert,update,delete
on public.course_communication_reads
to authenticated;
grant select,insert,update
on public.course_communication_preferences
to authenticated;

create or replace function public.send_course_message(
  p_course_id uuid,
  p_body text,
  p_message_kind text default 'question',
  p_parent_message_id uuid default null,
  p_attachment_resource_id uuid default null
)
returns public.learning_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message public.learning_messages;
begin
  if (select auth.uid()) is null or not private.can_access_course(p_course_id) then
    raise exception 'A current course member is required';
  end if;
  if p_message_kind not in ('question','reply','course_note') then
    raise exception 'Unsupported course message kind';
  end if;

  insert into public.learning_messages(
    course_id,recipient_id,body,message_kind,
    parent_message_id,attachment_resource_id
  ) values (
    p_course_id,null,trim(p_body),p_message_kind,
    p_parent_message_id,p_attachment_resource_id
  )
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.publish_course_announcement(
  p_course_id uuid,
  p_title text,
  p_body text
)
returns public.professor_announcements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_announcement public.professor_announcements;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then
    raise exception 'Only a current course manager can publish an announcement';
  end if;

  insert into public.professor_announcements(
    course_id,audience,title,body,is_published,published_at
  ) values (
    p_course_id,'course',trim(p_title),trim(p_body),true,now()
  )
  returning * into v_announcement;
  return v_announcement;
end;
$$;

create or replace function public.mark_course_communication_read(
  p_course_id uuid,
  p_message_ids uuid[] default '{}'::uuid[],
  p_announcement_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.can_access_course(p_course_id) then
    raise exception 'A current course member is required';
  end if;

  insert into public.course_communication_reads(
    course_id,user_id,message_id,read_at
  )
  select p_course_id,(select auth.uid()),m.id,now()
  from public.learning_messages m
  where m.course_id=p_course_id
    and m.recipient_id is null
    and m.id=any(coalesce(p_message_ids,'{}'::uuid[]))
  on conflict(user_id,message_id) where message_id is not null
  do update set read_at=excluded.read_at;

  insert into public.course_communication_reads(
    course_id,user_id,announcement_id,read_at
  )
  select p_course_id,(select auth.uid()),a.id,now()
  from public.professor_announcements a
  where a.course_id=p_course_id
    and a.audience='course'
    and a.is_published
    and a.id=any(coalesce(p_announcement_ids,'{}'::uuid[]))
  on conflict(user_id,announcement_id) where announcement_id is not null
  do update set read_at=excluded.read_at;
end;
$$;

revoke all on function public.send_course_message(uuid,text,text,uuid,uuid) from public;
revoke all on function public.publish_course_announcement(uuid,text,text) from public;
revoke all on function public.mark_course_communication_read(uuid,uuid[],uuid[]) from public;
revoke execute on function public.send_course_message(uuid,text,text,uuid,uuid) from anon;
revoke execute on function public.publish_course_announcement(uuid,text,text) from anon;
revoke execute on function public.mark_course_communication_read(uuid,uuid[],uuid[]) from anon;
grant execute on function public.send_course_message(uuid,text,text,uuid,uuid) to authenticated;
grant execute on function public.publish_course_announcement(uuid,text,text) to authenticated;
grant execute on function public.mark_course_communication_read(uuid,uuid[],uuid[]) to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='professor_announcements'
  ) then
    alter publication supabase_realtime
      add table public.professor_announcements;
  end if;
end;
$$;
