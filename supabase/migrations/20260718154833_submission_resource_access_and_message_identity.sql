drop policy if exists learning_resources_select on public.learning_resources;
create policy learning_resources_select on public.learning_resources
for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    assignment_id is not null
    and private.can_manage_assignment(assignment_id)
  )
  or (
    course_id is not null
    and private.can_access_course(course_id)
    and visibility in ('course','public','publisher')
  )
);

drop policy if exists learning_resources_update on public.learning_resources;
create policy learning_resources_update on public.learning_resources
for update to authenticated
using (
  owner_id = (select auth.uid())
  or (assignment_id is not null and private.can_manage_assignment(assignment_id))
  or (course_id is not null and private.can_manage_course(course_id))
)
with check (
  owner_id = (select auth.uid())
  or (assignment_id is not null and private.can_manage_assignment(assignment_id))
  or (course_id is not null and private.can_manage_course(course_id))
);

drop policy if exists learning_resources_delete on public.learning_resources;
create policy learning_resources_delete on public.learning_resources
for delete to authenticated
using (
  owner_id = (select auth.uid())
  or (assignment_id is not null and private.can_manage_assignment(assignment_id))
  or (course_id is not null and private.can_manage_course(course_id))
);

create or replace function private.set_learning_message_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id is distinct from auth.uid() then
    raise exception 'The sender must match the authenticated user';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), 'Course member')
  into new.sender_label
  from public.profiles p
  where p.id = new.sender_id;

  new.sender_label := coalesce(new.sender_label, 'Course member');
  return new;
end;
$$;

revoke all on function private.set_learning_message_identity() from public;

drop trigger if exists learning_messages_set_identity on public.learning_messages;
create trigger learning_messages_set_identity
before insert or update of sender_id, sender_label
on public.learning_messages
for each row execute function private.set_learning_message_identity();
