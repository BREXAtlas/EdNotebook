-- Follow-up hardening applied after the initial production-security migration.
-- The statements are idempotent so the file can be replayed against projects
-- where the live fixes were already applied during rollout verification.

create index if not exists audit_events_assignment_id_idx
  on public.audit_events (assignment_id);
create index if not exists audit_events_institution_id_idx
  on public.audit_events (institution_id);
create index if not exists audit_events_resource_id_idx
  on public.audit_events (resource_id);
create index if not exists file_deletion_requests_requested_by_idx
  on public.file_deletion_requests (requested_by);
create index if not exists file_deletion_requests_secure_file_id_idx
  on public.file_deletion_requests (secure_file_id);
create index if not exists learning_resources_link_preview_id_idx
  on public.learning_resources (link_preview_id);
create index if not exists legal_hold_files_added_by_idx
  on public.legal_hold_files (added_by);
create index if not exists legal_hold_files_secure_file_id_idx
  on public.legal_hold_files (secure_file_id);
create index if not exists legal_holds_created_by_idx
  on public.legal_holds (created_by);
create index if not exists plan_entitlements_entitlement_key_idx
  on public.plan_entitlements (entitlement_key);
create index if not exists processing_jobs_secure_file_id_idx
  on public.processing_jobs (secure_file_id);
create index if not exists profiles_plan_key_idx
  on public.profiles (plan_key);
create index if not exists publications_secure_file_id_idx
  on public.publications (secure_file_id);
create index if not exists retention_policies_created_by_idx
  on public.retention_policies (created_by);
create index if not exists secure_file_objects_institution_id_idx
  on public.secure_file_objects (institution_id);
create index if not exists stripe_price_plan_map_plan_key_idx
  on public.stripe_price_plan_map (plan_key);
create index if not exists user_entitlements_entitlement_key_idx
  on public.user_entitlements (entitlement_key);

-- Owners always see their own vault rows. Course members see released course
-- materials. Assignment managers additionally see private submission rows.
drop policy if exists learning_resources_select on public.learning_resources;
create policy learning_resources_select
on public.learning_resources
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or (
    assignment_id is not null
    and private.can_manage_assignment(assignment_id)
  )
  or (
    course_id is not null
    and private.can_access_course(course_id)
    and visibility in ('course', 'public', 'publisher')
  )
);

drop policy if exists learning_resources_update on public.learning_resources;
create policy learning_resources_update
on public.learning_resources
for update
to authenticated
using (
  owner_id = (select auth.uid())
  or (
    assignment_id is not null
    and private.can_manage_assignment(assignment_id)
  )
  or (
    course_id is not null
    and private.can_manage_course(course_id)
  )
)
with check (
  owner_id = (select auth.uid())
  or (
    assignment_id is not null
    and private.can_manage_assignment(assignment_id)
  )
  or (
    course_id is not null
    and private.can_manage_course(course_id)
  )
);

drop policy if exists learning_resources_delete on public.learning_resources;
create policy learning_resources_delete
on public.learning_resources
for delete
to authenticated
using (
  owner_id = (select auth.uid())
  or (
    assignment_id is not null
    and private.can_manage_assignment(assignment_id)
  )
  or (
    course_id is not null
    and private.can_manage_course(course_id)
  )
);

-- The database—not browser-supplied text—sets the displayed sender identity.
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

drop trigger if exists learning_messages_set_identity
on public.learning_messages;

create trigger learning_messages_set_identity
before insert or update of sender_id, sender_label
on public.learning_messages
for each row
execute function private.set_learning_message_identity();
