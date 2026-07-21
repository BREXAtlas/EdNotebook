-- Student-data and delegated-administration safety hardening.
-- This migration is additive and preserves existing records. It narrows legacy
-- manager semantics, makes delegated capabilities resource-specific, replaces
-- direct governance writes with audited RPCs, and enforces tenant-consistent
-- course, roster, enrollment, grade, and grade-share references.

-- Publication-backed learning resources need the same explicit relationship
-- used by the access helper, scope trigger, and preflight checks below.
alter table public.learning_resources
  add column if not exists publication_id uuid
  references public.publications(id) on delete set null;

create index if not exists learning_resources_publication_idx
  on public.learning_resources(publication_id)
  where publication_id is not null;

-- ---------------------------------------------------------------------------
-- Platform and institution authorization helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner((select auth.uid()));
$$;

create or replace function private.has_platform_capability(
  p_capability text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and p_capability = any(array[
      'view_control_center','view_accounts','view_feature_controls',
      'view_integrations','test_integrations','view_audit','view_reports'
    ]::text[])
    and (
      private.is_platform_owner(p_user_id)
      or exists (
        select 1
        from public.platform_admin_authorizations paa
        where paa.user_id = p_user_id
          and paa.status = 'active'
          and (paa.expires_at is null or paa.expires_at > now())
          and paa.capabilities @> jsonb_build_object(p_capability, true)
      )
    );
$$;

create or replace function private.has_platform_control_access(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_platform_capability('view_control_center', p_user_id);
$$;

create or replace function private.course_membership_is_current(
  p_course_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course_id is not null and p_user_id is not null and exists (
    select 1 from public.courses c
    where c.id=p_course_id
      and (
        c.institution_id is null
        or (p_role='learner' and private.has_active_institution_affiliation(p_user_id,c.institution_id,'student'))
        or (p_role in ('owner','professor') and private.has_active_institution_affiliation(p_user_id,c.institution_id,'professor'))
        or (p_role='publisher' and private.has_active_institution_affiliation(p_user_id,c.institution_id,'publisher'))
        or (p_role='admin' and (
          private.has_active_institution_affiliation(p_user_id,c.institution_id,'professor')
          or exists(select 1 from public.institution_memberships im where im.institution_id=c.institution_id and im.user_id=p_user_id and im.status='active' and im.role in ('owner','admin'))
        ))
      )
  );
$$;

create or replace function private.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course_id is not null and (
    private.is_platform_owner((select auth.uid()))
    or exists(
      select 1 from public.courses c
      where c.id=p_course_id and c.owner_id=(select auth.uid())
        and private.course_membership_is_current(c.id,c.owner_id,'owner')
    )
    or exists(
      select 1 from public.course_memberships cm
      where cm.course_id=p_course_id and cm.user_id=(select auth.uid())
        and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
    )
  );
$$;

create or replace function private.course_message_recipient_is_current(
  p_course_id uuid,
  p_recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course_id is not null and p_recipient_id is not null and exists (
    select 1
    from public.courses c
    where c.id=p_course_id
      and (
        (c.owner_id=p_recipient_id and private.course_membership_is_current(c.id,p_recipient_id,'owner'))
        or exists (
          select 1 from public.course_memberships cm
          where cm.course_id=c.id and cm.user_id=p_recipient_id
            and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
        )
      )
  );
$$;

create or replace function private.can_manage_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_course_id is not null and (
    private.is_platform_owner((select auth.uid()))
    or exists(
      select 1 from public.courses c
      where c.id=p_course_id and c.owner_id=(select auth.uid())
        and private.course_membership_is_current(c.id,c.owner_id,'owner')
    )
    or exists(
      select 1 from public.course_memberships cm
      where cm.course_id=p_course_id and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin','professor')
        and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
    )
  );
$$;

create or replace function private.institution_role_baseline_capability(
  p_role text,
  p_capability text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_role
    when 'owner' then p_capability = any(array[
      'view_control_center','view_accounts','control_features','view_integrations',
      'manage_integrations','test_integrations','view_audit','export_reports',
      'manage_team','manage_affiliations','manage_institution_profile',
      'view_security','view_records','manage_retention','manage_courses'
    ]::text[])
    when 'admin' then p_capability = 'view_control_center'
    when 'security' then p_capability = any(array[
      'view_control_center','view_integrations','test_integrations','view_audit','view_security'
    ]::text[])
    when 'records' then p_capability = any(array[
      'view_control_center','view_accounts','view_audit','export_reports','view_records','manage_retention'
    ]::text[])
    else false
  end;
$$;

create or replace function private.has_institution_capability(
  p_institution_id uuid,
  p_capability text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_institution_id is not null
    and p_user_id is not null
    and p_capability = any(array[
      'view_control_center','view_accounts','control_features','view_integrations',
      'manage_integrations','test_integrations','view_audit','export_reports',
      'manage_team','manage_affiliations','manage_institution_profile',
      'view_security','view_records','manage_retention','manage_courses'
    ]::text[])
    and (
      private.is_platform_owner(p_user_id)
      or exists (
        select 1
        from public.institution_memberships im
        where im.institution_id = p_institution_id
          and im.user_id = p_user_id
          and im.status = 'active'
          and (
            private.institution_role_baseline_capability(im.role, p_capability)
            or im.permissions @> jsonb_build_object(p_capability, true)
          )
      )
    );
$$;

create or replace function private.is_institution_manager(
  p_institution_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_institution_id is not null and p_user_id is not null and (
    private.is_platform_owner(p_user_id)
    or exists (
      select 1 from public.institution_memberships im
      where im.institution_id = p_institution_id
        and im.user_id = p_user_id
        and im.status = 'active'
        and (
          im.role = 'owner'
          or (im.role = 'admin' and im.permissions @> '{"manage_institution_profile":true}'::jsonb)
        )
    )
  );
$$;

create or replace function private.can_view_integration_connection(
  p_connection_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.integration_connections c
    where c.id = p_connection_id
      and (
        private.has_platform_capability('view_integrations', p_user_id)
        or (
          c.institution_id is not null
          and private.has_institution_capability(c.institution_id, 'view_integrations', p_user_id)
        )
      )
  );
$$;

create or replace function private.can_access_publication(
  p_publication_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.publications p
    where p.id=p_publication_id
      and (
        p.owner_id=p_user_id
        or (p.status='published' and p.access_model='open')
        or (p.course_id is not null and private.can_access_course(p.course_id))
        or exists (
          select 1 from public.publication_entitlements pe
          where pe.publication_id=p.id and pe.user_id=p_user_id and pe.active
            and pe.starts_at<=now() and (pe.expires_at is null or pe.expires_at>now())
        )
        or private.is_platform_owner(p_user_id)
      )
  );
$$;

create or replace function private.can_access_secure_file(
  p_file_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.secure_file_objects f
    where f.id=p_file_id and f.availability_status<>'deleted'
      and (
        f.owner_id=p_user_id
        or (f.purpose='course' and f.course_id is not null and private.can_access_course(f.course_id))
        or (f.purpose='submission' and (
          (f.assignment_id is not null and private.can_manage_assignment(f.assignment_id))
          or (f.course_id is not null and private.can_manage_course(f.course_id))
        ))
        or (f.purpose='publication' and f.publication_id is not null and private.can_access_publication(f.publication_id,p_user_id))
        or (f.purpose in ('private','preview','export') and (
          (f.assignment_id is not null and private.can_manage_assignment(f.assignment_id))
          or (f.course_id is not null and private.can_manage_course(f.course_id))
        ))
        or private.is_platform_owner(p_user_id)
      )
  );
$$;

create or replace function private.can_manage_secure_file(
  p_file_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.secure_file_objects f
    where f.id=p_file_id and f.availability_status<>'deleted'
      and (
        f.owner_id=p_user_id
        or (f.purpose in ('course','submission','private','preview','export') and (
          (f.assignment_id is not null and private.can_manage_assignment(f.assignment_id))
          or (f.course_id is not null and private.can_manage_course(f.course_id))
        ))
        or (f.purpose='publication' and (
          exists(select 1 from public.publications p where p.id=f.publication_id and p.owner_id=p_user_id)
          or (f.course_id is not null and private.can_manage_course(f.course_id))
        ))
        or private.is_platform_owner(p_user_id)
      )
  );
$$;

-- The publication relationship is browser-visible, so RLS must authorize it
-- independently of course, assignment, and secure-file relationships.
drop policy if exists learning_resources_insert on public.learning_resources;
create policy learning_resources_insert on public.learning_resources
for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and (course_id is null or private.can_access_course(course_id))
  and (assignment_id is null or private.can_access_assignment(assignment_id))
  and (secure_file_id is null or private.can_access_secure_file(secure_file_id,(select auth.uid())))
  and (publication_id is null or private.can_access_publication(publication_id,(select auth.uid())))
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
  (
    owner_id=(select auth.uid())
    or (assignment_id is not null and private.can_manage_assignment(assignment_id))
    or (course_id is not null and private.can_manage_course(course_id))
  )
  and (publication_id is null or private.can_access_publication(publication_id,(select auth.uid())))
);

create or replace function private.user_has_current_student_group_context(
  p_group_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.student_groups g
    where g.id=p_group_id
      and (
        (g.course_id is null and g.institution_id is null)
        or (
          g.course_id is not null and exists (
            select 1 from public.course_memberships cm
            where cm.course_id=g.course_id and cm.user_id=p_user_id
              and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
          )
        )
        or (
          g.course_id is null and g.institution_id is not null and (
            private.has_active_institution_affiliation(p_user_id,g.institution_id,null)
            or exists (
              select 1 from public.institution_memberships im
              where im.institution_id=g.institution_id and im.user_id=p_user_id and im.status='active'
            )
          )
        )
      )
  );
$$;

create or replace function private.can_access_student_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_group_id is not null and exists (
    select 1
    from public.student_groups g
    where g.id=p_group_id
      and (
        g.visibility='public'
        or private.is_platform_owner((select auth.uid()))
        or (
          private.user_has_current_student_group_context(g.id,(select auth.uid()))
          and (
            g.created_by=(select auth.uid())
            or g.visibility in ('course','institution')
            or exists (
              select 1 from public.student_group_memberships gm
              where gm.group_id=g.id and gm.user_id=(select auth.uid())
            )
          )
        )
      )
  );
$$;

create or replace function private.can_manage_student_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_group_id is not null and exists (
    select 1
    from public.student_groups g
    where g.id=p_group_id
      and (
        private.is_platform_owner((select auth.uid()))
        or (
          private.user_has_current_student_group_context(g.id,(select auth.uid()))
          and (
            g.created_by=(select auth.uid())
            or (g.course_id is not null and private.can_manage_course(g.course_id))
            or exists (
              select 1 from public.student_group_memberships gm
              where gm.group_id=g.id and gm.user_id=(select auth.uid()) and gm.role in ('owner','moderator')
            )
          )
        )
      )
  );
$$;

create or replace function private.shares_course_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_other_user_id is not null and exists (
    select 1
    from public.course_memberships mine
    join public.course_memberships theirs on theirs.course_id=mine.course_id
    where mine.user_id=(select auth.uid()) and theirs.user_id=p_other_user_id
      and private.course_membership_is_current(mine.course_id,mine.user_id,mine.role)
      and private.course_membership_is_current(theirs.course_id,theirs.user_id,theirs.role)
  );
$$;

revoke all on function private.is_platform_manager() from public;
revoke all on function private.has_platform_capability(text,uuid) from public;
revoke all on function private.has_platform_control_access(uuid) from public;
revoke all on function private.course_membership_is_current(uuid,uuid,text) from public;
revoke all on function private.can_access_course(uuid) from public;
revoke all on function private.course_message_recipient_is_current(uuid,uuid) from public;
revoke all on function private.can_manage_course(uuid) from public;
revoke all on function private.institution_role_baseline_capability(text,text) from public;
revoke all on function private.has_institution_capability(uuid,text,uuid) from public;
revoke all on function private.is_institution_manager(uuid,uuid) from public;
revoke all on function private.can_view_integration_connection(uuid,uuid) from public;
revoke all on function private.can_access_publication(uuid,uuid) from public;
revoke all on function private.can_access_secure_file(uuid,uuid) from public;
revoke all on function private.can_manage_secure_file(uuid,uuid) from public;
revoke all on function private.user_has_current_student_group_context(uuid,uuid) from public;
revoke all on function private.can_access_student_group(uuid) from public;
revoke all on function private.can_manage_student_group(uuid) from public;
revoke all on function private.shares_course_with(uuid) from public;
grant execute on function private.is_platform_manager() to authenticated;
grant execute on function private.has_platform_capability(text,uuid) to authenticated;
grant execute on function private.has_platform_control_access(uuid) to authenticated;
grant execute on function private.course_membership_is_current(uuid,uuid,text) to authenticated;
grant execute on function private.can_access_course(uuid) to authenticated;
grant execute on function private.course_message_recipient_is_current(uuid,uuid) to authenticated;
grant execute on function private.can_manage_course(uuid) to authenticated;
grant execute on function private.institution_role_baseline_capability(text,text) to authenticated;
grant execute on function private.has_institution_capability(uuid,text,uuid) to authenticated;
grant execute on function private.is_institution_manager(uuid,uuid) to authenticated;
grant execute on function private.can_view_integration_connection(uuid,uuid) to authenticated;
grant execute on function private.can_access_publication(uuid,uuid) to authenticated;
grant execute on function private.can_access_secure_file(uuid,uuid) to authenticated;
grant execute on function private.can_manage_secure_file(uuid,uuid) to authenticated;
grant execute on function private.user_has_current_student_group_context(uuid,uuid) to authenticated;
grant execute on function private.can_access_student_group(uuid) to authenticated;
grant execute on function private.can_manage_student_group(uuid) to authenticated;
grant execute on function private.shares_course_with(uuid) to authenticated;

drop policy if exists student_groups_insert on public.student_groups;
create policy student_groups_insert
on public.student_groups for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (course_id is null or private.can_access_course(course_id))
  and (
    institution_id is null
    or private.has_active_institution_affiliation((select auth.uid()),institution_id,null)
    or exists (
      select 1 from public.institution_memberships im
      where im.institution_id=student_groups.institution_id
        and im.user_id=(select auth.uid()) and im.status='active'
    )
  )
);

-- A course message is a tenant-scoped record, not a platform-wide direct
-- message channel. Personal course-less messages are limited to self-notes;
-- course recipients must still be current members of that exact course.
drop policy if exists learning_messages_select on public.learning_messages;
create policy learning_messages_select
on public.learning_messages for select to authenticated
using (
  (
    course_id is null
    and sender_id=(select auth.uid())
    and (recipient_id is null or recipient_id=(select auth.uid()))
  )
  or (
    course_id is not null
    and private.can_access_course(course_id)
    and (
      sender_id=(select auth.uid())
      or recipient_id=(select auth.uid())
      or recipient_id is null
    )
  )
);

drop policy if exists learning_messages_insert on public.learning_messages;
create policy learning_messages_insert
on public.learning_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and (
    (
      course_id is null
      and assignment_id is null
      and (recipient_id is null or recipient_id=(select auth.uid()))
    )
    or (
      course_id is not null
      and private.can_access_course(course_id)
      and (recipient_id is null or private.course_message_recipient_is_current(course_id,recipient_id))
      and (
        assignment_id is null
        or exists (
          select 1 from public.assignments a
          where a.id=learning_messages.assignment_id and a.course_id=learning_messages.course_id
        )
      )
    )
  )
);

drop policy if exists learning_messages_delete on public.learning_messages;
create policy learning_messages_delete
on public.learning_messages for delete to authenticated
using (
  sender_id=(select auth.uid())
  and (course_id is null or private.can_access_course(course_id))
);

-- Resource-specific policies replace the earlier broad "any control-center
-- assignment" checks. Definitions remain readable because the authenticated
-- application needs them to resolve ordinary feature manifests.

drop policy if exists institution_applications_select on public.institution_access_applications;
create policy institution_applications_select
on public.institution_access_applications for select to authenticated
using (applicant_id = (select auth.uid()) or private.is_platform_owner((select auth.uid())));

drop policy if exists institution_affiliations_select on public.institution_affiliations;
create policy institution_affiliations_select
on public.institution_affiliations for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_platform_capability('view_accounts', (select auth.uid()))
  or (
    institution_id is not null
    and private.has_institution_capability(institution_id, 'view_accounts', (select auth.uid()))
  )
);

drop policy if exists institution_transfers_select on public.institution_transfer_requests;
create policy institution_transfers_select
on public.institution_transfer_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_platform_owner((select auth.uid()))
  or (from_institution_id is not null and private.has_institution_capability(from_institution_id, 'manage_affiliations', (select auth.uid())))
  or (to_institution_id is not null and private.has_institution_capability(to_institution_id, 'manage_affiliations', (select auth.uid())))
);

drop policy if exists institution_team_invitations_select on public.institution_team_invitations;
create policy institution_team_invitations_select
on public.institution_team_invitations for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or private.has_institution_capability(institution_id, 'manage_team', (select auth.uid()))
  or lower(email) = lower(coalesce((select p.email from public.profiles p where p.id = (select auth.uid())), ''))
);

drop policy if exists feature_policies_select on public.feature_policies;
create policy feature_policies_select
on public.feature_policies for select to authenticated
using (
  private.has_platform_capability('view_feature_controls', (select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'control_features', (select auth.uid())))
);

drop policy if exists feature_templates_select on public.feature_policy_templates;
create policy feature_templates_select
on public.feature_policy_templates for select to authenticated
using (
  (institution_id is null and private.has_platform_capability('view_feature_controls',(select auth.uid())))
  or (institution_id is not null and (
    private.has_platform_capability('view_feature_controls',(select auth.uid()))
    or private.has_institution_capability(institution_id,'control_features',(select auth.uid()))
  ))
);

drop policy if exists feature_template_items_select on public.feature_policy_template_items;
create policy feature_template_items_select
on public.feature_policy_template_items for select to authenticated
using (exists (
  select 1 from public.feature_policy_templates t
  where t.id=feature_policy_template_items.template_id
    and (
      private.has_platform_capability('view_feature_controls',(select auth.uid()))
      or (t.institution_id is not null and private.has_institution_capability(t.institution_id,'control_features',(select auth.uid())))
    )
));

drop policy if exists feature_change_sets_select on public.feature_change_sets;
create policy feature_change_sets_select
on public.feature_change_sets for select to authenticated
using (
  private.has_platform_capability('view_audit', (select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'view_audit', (select auth.uid())))
);

drop policy if exists feature_change_items_select on public.feature_change_items;
create policy feature_change_items_select
on public.feature_change_items for select to authenticated
using (exists (
  select 1 from public.feature_change_sets cs
  where cs.id = feature_change_items.change_set_id
    and (
      private.has_platform_capability('view_audit', (select auth.uid()))
      or (cs.institution_id is not null and private.has_institution_capability(cs.institution_id, 'view_audit', (select auth.uid())))
    )
));

drop policy if exists integration_connections_select on public.integration_connections;
create policy integration_connections_select
on public.integration_connections for select to authenticated
using (
  private.has_platform_capability('view_integrations', (select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'view_integrations', (select auth.uid())))
);

drop policy if exists admin_report_exports_select on public.admin_report_exports;
create policy admin_report_exports_select
on public.admin_report_exports for select to authenticated
using (
  requested_by = (select auth.uid())
  or private.has_platform_capability('view_reports', (select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'export_reports', (select auth.uid())))
);

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select
on public.audit_events for select to authenticated
using (
  actor_id = (select auth.uid())
  or private.has_platform_capability('view_audit', (select auth.uid()))
  or (course_id is not null and private.can_manage_course(course_id))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'view_audit', (select auth.uid())))
);

-- ---------------------------------------------------------------------------
-- Least-privilege direct grants and governance read policies
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.institutions from authenticated;
revoke insert, update, delete on public.institution_memberships from authenticated;
revoke insert, update, delete on public.retention_policies from authenticated;
revoke insert, update, delete on public.legal_holds from authenticated;
revoke insert, update, delete on public.legal_hold_files from authenticated;

drop policy if exists institutions_insert on public.institutions;
drop policy if exists institutions_update on public.institutions;
drop policy if exists institutions_delete on public.institutions;
drop policy if exists institution_memberships_insert on public.institution_memberships;
drop policy if exists institution_memberships_update on public.institution_memberships;
drop policy if exists institution_memberships_delete on public.institution_memberships;
drop policy if exists retention_policies_insert on public.retention_policies;
drop policy if exists retention_policies_update on public.retention_policies;
drop policy if exists retention_policies_delete on public.retention_policies;
drop policy if exists legal_holds_insert on public.legal_holds;
drop policy if exists legal_holds_update on public.legal_holds;
drop policy if exists legal_holds_delete on public.legal_holds;
drop policy if exists legal_hold_files_insert on public.legal_hold_files;
drop policy if exists legal_hold_files_delete on public.legal_hold_files;

drop policy if exists institution_memberships_select on public.institution_memberships;
create policy institution_memberships_select
on public.institution_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_platform_owner((select auth.uid()))
  or private.has_institution_capability(institution_id, 'view_accounts', (select auth.uid()))
);

drop policy if exists retention_policies_select on public.retention_policies;
create policy retention_policies_select
on public.retention_policies for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'manage_retention', (select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
);

drop policy if exists legal_holds_select on public.legal_holds;
create policy legal_holds_select
on public.legal_holds for select to authenticated
using (
  private.is_platform_owner((select auth.uid()))
  or (institution_id is not null and private.has_institution_capability(institution_id, 'manage_retention', (select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
);

drop policy if exists legal_hold_files_select on public.legal_hold_files;
create policy legal_hold_files_select
on public.legal_hold_files for select to authenticated
using (exists (
  select 1 from public.legal_holds h
  where h.id = legal_hold_id
    and (
      private.is_platform_owner((select auth.uid()))
      or (h.institution_id is not null and private.has_institution_capability(h.institution_id, 'manage_retention', (select auth.uid())))
      or (h.course_id is not null and private.can_manage_course(h.course_id))
    )
));

-- ---------------------------------------------------------------------------
-- Capability-filtered administration reads
-- ---------------------------------------------------------------------------

create or replace function public.get_my_admin_workspaces()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner boolean;
  v_authorization jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_owner := private.is_platform_owner(v_user_id);

  select jsonb_build_object(
    'user_id',paa.user_id,'access_level',paa.access_level,'capabilities',paa.capabilities,
    'status',paa.status,'granted_by',paa.granted_by,'granted_at',paa.granted_at,
    'expires_at',paa.expires_at,'revoked_at',paa.revoked_at,'updated_at',paa.updated_at
  ) into v_authorization
  from public.platform_admin_authorizations paa
  where paa.user_id = v_user_id;

  return jsonb_build_object(
    'platform_access', private.has_platform_capability('view_control_center', v_user_id),
    'platform_owner', v_owner,
    'platform_capabilities', jsonb_build_object(
      'view_control_center',private.has_platform_capability('view_control_center',v_user_id),
      'view_accounts',private.has_platform_capability('view_accounts',v_user_id),
      'view_feature_controls',private.has_platform_capability('view_feature_controls',v_user_id),
      'view_integrations',private.has_platform_capability('view_integrations',v_user_id),
      'test_integrations',private.has_platform_capability('test_integrations',v_user_id),
      'view_audit',private.has_platform_capability('view_audit',v_user_id),
      'view_reports',private.has_platform_capability('view_reports',v_user_id)
    ),
    'platform_authorization', v_authorization,
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'name',i.name,'slug',i.slug,'role',im.role,'permissions',im.permissions,
        'lifecycle_status',i.lifecycle_status,'institution_code',i.institution_code
      ) order by i.name)
      from public.institution_memberships im
      join public.institutions i on i.id=im.institution_id
      where im.user_id=v_user_id and im.status='active' and im.role in ('owner','admin','security','records')
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_admin_control_center(p_institution_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner boolean;
  v_can_open boolean;
  v_can_view_accounts boolean;
  v_can_view_features boolean;
  v_can_view_integrations boolean;
  v_can_test_integrations boolean;
  v_can_view_audit boolean;
  v_can_view_reports boolean;
  v_can_manage_affiliations boolean;
  v_can_manage_team boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_owner := private.is_platform_owner(v_user_id);
  v_can_open := v_owner
    or private.has_platform_capability('view_control_center',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'view_control_center',v_user_id));
  if not v_can_open then
    if p_institution_id is null then
      raise exception 'Platform control-center access required';
    else
      raise exception 'Institution control-center access required';
    end if;
  end if;

  v_can_view_accounts := v_owner
    or private.has_platform_capability('view_accounts',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'view_accounts',v_user_id));
  v_can_view_features := v_owner
    or private.has_platform_capability('view_feature_controls',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'control_features',v_user_id));
  v_can_view_integrations := v_owner
    or private.has_platform_capability('view_integrations',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'view_integrations',v_user_id));
  v_can_test_integrations := v_owner
    or private.has_platform_capability('test_integrations',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'test_integrations',v_user_id));
  v_can_view_audit := v_owner
    or private.has_platform_capability('view_audit',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'view_audit',v_user_id));
  v_can_view_reports := v_owner
    or private.has_platform_capability('view_reports',v_user_id)
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'export_reports',v_user_id));
  v_can_manage_affiliations := v_owner
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'manage_affiliations',v_user_id));
  v_can_manage_team := v_owner
    or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'manage_team',v_user_id));

  return jsonb_build_object(
    'access', jsonb_build_object(
      'current_user_id',v_user_id,
      'platform_owner',v_owner,
      'platform_access',private.has_platform_capability('view_control_center',v_user_id),
      'institution_id',p_institution_id,
      'can_view_accounts',v_can_view_accounts,
      'can_view_feature_controls',v_can_view_features,
      'can_view_integrations',v_can_view_integrations,
      'can_test_integrations',v_can_test_integrations,
      'can_view_audit',v_can_view_audit,
      'can_view_reports',v_can_view_reports,
      'can_control_features',v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'control_features',v_user_id)),
      'can_manage_team',v_can_manage_team,
      'can_manage_affiliations',v_can_manage_affiliations,
      'can_manage_integrations',v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'manage_integrations',v_user_id)),
      'can_export_reports',v_owner or (p_institution_id is not null and private.has_institution_capability(p_institution_id,'export_reports',v_user_id))
    ),
    'institutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'name',i.name,'slug',i.slug,'institution_code',i.institution_code,
        'primary_lms',i.primary_lms,'lifecycle_status',i.lifecycle_status,
        'institution_type',i.institution_type,'system_name',i.system_name,'timezone_name',i.timezone_name
      ) order by i.name)
      from public.institutions i
      where (p_institution_id is null and private.has_platform_capability('view_control_center',v_user_id))
        or i.id=p_institution_id
    ), '[]'::jsonb),
    'statistics', jsonb_build_object(
      'accounts',case when v_can_view_accounts then (select count(*) from public.institution_memberships im where p_institution_id is null or im.institution_id=p_institution_id) else 0 end,
      'courses',case when v_can_view_accounts then (select count(*) from public.courses c where p_institution_id is null or c.institution_id=p_institution_id) else 0 end,
      'active_features',case when v_can_view_features then (select count(*) from public.feature_definitions fd where fd.active) else 0 end,
      'pending_applications',case when v_owner then (select count(*) from public.institution_access_applications a where a.status in ('pending','reviewing')) else 0 end,
      'pending_affiliations',case when v_can_manage_affiliations then (select count(*) from public.identity_onboarding_requests ior where ior.verification_status='pending' and (p_institution_id is null or ior.institution_id=p_institution_id)) else 0 end,
      'pending_transfers',case when v_can_manage_affiliations then (select count(*) from public.institution_transfer_requests tr where tr.status in ('pending','reviewing') and (p_institution_id is null or tr.from_institution_id=p_institution_id or tr.to_institution_id=p_institution_id)) else 0 end
    ),
    'features',case when v_can_view_features then coalesce((select jsonb_agg(to_jsonb(fd) order by fd.pathway,fd.sort_order,fd.display_name) from public.feature_definitions fd where fd.active),'[]'::jsonb) else '[]'::jsonb end,
    'policies',case when v_can_view_features then coalesce((select jsonb_agg(to_jsonb(fp) order by fp.created_at desc) from public.feature_policies fp where fp.control_status in ('scheduled','active') and (p_institution_id is null or fp.institution_id=p_institution_id or fp.scope_type in ('platform','platform_pathway'))),'[]'::jsonb) else '[]'::jsonb end,
    'connections',case when v_can_view_integrations then coalesce((select jsonb_agg((to_jsonb(ic)-'secret_reference_names') order by ic.category,ic.display_name) from public.integration_connections ic where p_institution_id is null or ic.institution_id is null or ic.institution_id=p_institution_id),'[]'::jsonb) else '[]'::jsonb end,
    'changes',case when v_can_view_audit then coalesce((select jsonb_agg(to_jsonb(cs) order by cs.created_at desc) from (select * from public.feature_change_sets fcs where p_institution_id is null or fcs.institution_id=p_institution_id order by created_at desc limit 200) cs),'[]'::jsonb) else '[]'::jsonb end,
    'applications',case when v_owner then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.institution_access_applications order by created_at desc limit 100) a),'[]'::jsonb) else '[]'::jsonb end,
    'onboarding_requests',case when v_can_manage_affiliations then coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',ior.user_id,'requested_role',ior.requested_role,'institution_id',ior.institution_id,
        'institution_directory_key',ior.institution_directory_key,'institution_name',ior.institution_name,
        'department',ior.department,'identifier_last4',ior.identifier_last4,'education_division',ior.education_division,
        'verification_status',ior.verification_status,'created_at',ior.created_at,'full_name',p.full_name,'email',p.email
      ) order by ior.created_at)
      from public.identity_onboarding_requests ior join public.profiles p on p.id=ior.user_id
      where ior.verification_status='pending' and (p_institution_id is null or ior.institution_id=p_institution_id)
    ),'[]'::jsonb) else '[]'::jsonb end,
    'transfers',case when v_can_manage_affiliations then coalesce((select jsonb_agg(to_jsonb(tr) order by tr.created_at desc) from (select * from public.institution_transfer_requests itr where p_institution_id is null or itr.from_institution_id=p_institution_id or itr.to_institution_id=p_institution_id order by created_at desc limit 100) tr),'[]'::jsonb) else '[]'::jsonb end,
    'team',case when p_institution_id is not null and (v_can_manage_team or v_can_view_accounts) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'institution_id',im.institution_id,'user_id',im.user_id,'role',im.role,'status',im.status,
        'permissions',im.permissions,'joined_at',im.joined_at,'last_active_at',im.last_active_at,
        'full_name',p.full_name,'email',p.email
      ) order by p.full_name)
      from public.institution_memberships im join public.profiles p on p.id=im.user_id
      where im.institution_id=p_institution_id and im.role in ('owner','admin','security','records')
    ),'[]'::jsonb) else '[]'::jsonb end,
    'reports',case when v_can_view_reports then coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select * from public.admin_report_exports ar where ar.requested_by=v_user_id or (p_institution_id is null and private.has_platform_capability('view_reports',v_user_id)) or ar.institution_id=p_institution_id order by created_at desc limit 100) r),'[]'::jsonb) else '[]'::jsonb end,
    'platform_authorizations',case when v_owner then coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',paa.user_id,'access_level',paa.access_level,'capabilities',paa.capabilities,
        'status',paa.status,'granted_by',paa.granted_by,'granted_at',paa.granted_at,
        'expires_at',paa.expires_at,'revoked_at',paa.revoked_at,'updated_at',paa.updated_at,
        'full_name',p.full_name,'email',p.email
      ) order by p.full_name,p.email)
      from public.platform_admin_authorizations paa join public.profiles p on p.id=paa.user_id
    ),'[]'::jsonb) else '[]'::jsonb end,
    'generated_at',now()
  );
end;
$$;

create or replace function public.admin_search_accounts_courses(
  p_query text,
  p_institution_id uuid default null,
  p_pathway text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_query text := lower(trim(coalesce(p_query,'')));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_pathway is not null and p_pathway not in ('student','professor','publisher') then raise exception 'Invalid pathway'; end if;
  if p_institution_id is null and not private.has_platform_capability('view_accounts',v_user_id) then
    raise exception 'Platform search access required';
  end if;
  if p_institution_id is not null and not (
    private.has_platform_capability('view_accounts',v_user_id)
    or private.has_institution_capability(p_institution_id,'view_accounts',v_user_id)
  ) then raise exception 'Institution account-search access required'; end if;

  return jsonb_build_object(
    'accounts',coalesce((
      select jsonb_agg(row_data order by row_data->>'full_name') from (
        select distinct
          jsonb_build_object(
            'user_id',p.id,'full_name',p.full_name,'email',p.email,'platform_role',p.role,
            'platform_owner',(p.role='owner'),'institution_id',coalesce(ia.institution_id,im.institution_id),
            'institution_name',i.name,'pathway',ia.pathway,'affiliation_status',ia.status,
            'membership_role',im.role,'membership_status',im.status
          ) row_data,
          p.full_name sort_full_name,
          p.id sort_user_id
        from public.profiles p
        left join public.institution_affiliations ia on ia.user_id=p.id
          and (p_institution_id is null or ia.institution_id=p_institution_id)
        left join public.institution_memberships im on im.user_id=p.id
          and (p_institution_id is null or im.institution_id=p_institution_id)
        left join public.institutions i on i.id=coalesce(ia.institution_id,im.institution_id)
        where (p_institution_id is null or ia.institution_id=p_institution_id or im.institution_id=p_institution_id)
          and (p_pathway is null or ia.pathway=p_pathway)
          and (v_query='' or lower(coalesce(p.full_name,'')) like '%'||v_query||'%' or lower(coalesce(p.email,'')) like '%'||v_query||'%')
        order by sort_full_name,sort_user_id
        limit 75
      ) account_rows
    ),'[]'::jsonb),
    'courses',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'institution_id',c.institution_id,'title',c.title,'course_code',c.course_code,
        'section_code',c.section_code,'teaching_window',c.teaching_window,'status',c.status,
        'access_scope',c.access_scope,'member_count',(select count(*) from public.course_memberships cm where cm.course_id=c.id)
      ) order by c.title)
      from (
        select c.*
        from public.courses c
        where (p_institution_id is null or c.institution_id=p_institution_id)
          and (v_query='' or lower(c.title) like '%'||v_query||'%' or lower(coalesce(c.course_code,'')) like '%'||v_query||'%')
        order by c.title,c.id
        limit 75
      ) c
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_my_admin_workspaces() from public, anon;
revoke all on function public.get_admin_control_center(uuid) from public, anon;
revoke all on function public.admin_search_accounts_courses(text,uuid,text) from public, anon;
grant execute on function public.get_my_admin_workspaces() to authenticated;
grant execute on function public.get_admin_control_center(uuid) to authenticated;
grant execute on function public.admin_search_accounts_courses(text,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Audited authorization and institution-team mutation paths
-- ---------------------------------------------------------------------------

revoke all on function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz) from public, anon, authenticated;
drop function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz);

create or replace function public.set_platform_admin_authorization(
  p_user_id uuid,
  p_access_level text,
  p_capabilities jsonb,
  p_status text,
  p_expires_at timestamptz,
  p_reason text,
  p_expected_updated_at timestamptz default null
)
returns public.platform_admin_authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.platform_admin_authorizations%rowtype;
  v_row public.platform_admin_authorizations;
  v_profile_role text;
  v_capability record;
begin
  if not private.is_platform_owner((select auth.uid())) then
    raise exception 'Only the platform owner can grant delegated platform access';
  end if;
  if p_user_id is null then raise exception 'Choose an existing account'; end if;
  select p.role into v_profile_role from public.profiles p where p.id=p_user_id;
  if not found then raise exception 'Account not found'; end if;
  if v_profile_role='owner' then raise exception 'The platform owner cannot be managed as a delegated authorization'; end if;
  if p_access_level not in ('operator','auditor','support') then raise exception 'Invalid delegated role'; end if;
  if p_status not in ('active','suspended','revoked') then raise exception 'Invalid authorization status'; end if;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason)) < 5 then raise exception 'A reason of at least 5 characters is required'; end if;
  if char_length(trim(p_reason)) > 1000 then raise exception 'The reason is too long'; end if;
  if jsonb_typeof(coalesce(p_capabilities,'{}'::jsonb)) <> 'object' then raise exception 'Capabilities must be a JSON object'; end if;

  for v_capability in select key,value from jsonb_each(coalesce(p_capabilities,'{}'::jsonb)) loop
    if v_capability.key <> all(array[
      'view_control_center','view_accounts','view_feature_controls',
      'view_integrations','test_integrations','view_audit','view_reports'
    ]::text[]) then raise exception 'Unknown platform capability: %',v_capability.key; end if;
    if jsonb_typeof(v_capability.value) <> 'boolean' then raise exception 'Capability % must be true or false',v_capability.key; end if;
  end loop;
  if p_status='active' and not (coalesce(p_capabilities,'{}'::jsonb) @> '{"view_control_center":true}'::jsonb) then
    raise exception 'Active delegated access must include view_control_center';
  end if;
  if p_status='active' and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'The access end must be in the future';
  end if;

  select * into v_existing from public.platform_admin_authorizations where user_id=p_user_id for update;
  if found then
    if p_expected_updated_at is null then raise exception 'The expected updated timestamp is required when changing an authorization'; end if;
    if v_existing.updated_at is distinct from p_expected_updated_at then raise exception 'This authorization changed after it was opened; reload and review it again'; end if;
    update public.platform_admin_authorizations
    set access_level=p_access_level,capabilities=coalesce(p_capabilities,'{}'::jsonb),status=p_status,
        granted_by=(select auth.uid()),granted_at=case when p_status='active' then now() else granted_at end,
        expires_at=p_expires_at,revoked_at=case when p_status='revoked' then now() else null end,updated_at=now()
    where user_id=p_user_id returning * into v_row;
  else
    if p_expected_updated_at is not null then raise exception 'No existing authorization matches the expected timestamp'; end if;
    insert into public.platform_admin_authorizations(
      user_id,access_level,capabilities,status,granted_by,expires_at,revoked_at
    ) values (
      p_user_id,p_access_level,coalesce(p_capabilities,'{}'::jsonb),p_status,(select auth.uid()),p_expires_at,
      case when p_status='revoked' then now() else null end
    ) returning * into v_row;
  end if;

  insert into public.audit_events(actor_id,event_type,target_type,target_id,details,event_hash)
  values(
    (select auth.uid()),'admin.platform_authorization_changed','profile',p_user_id::text,
    jsonb_build_object(
      'access_level',p_access_level,'status',p_status,'capabilities',coalesce(p_capabilities,'{}'::jsonb),
      'expires_at',p_expires_at,'reason',left(trim(p_reason),1000),
      'previous_status',v_existing.status,'previous_updated_at',v_existing.updated_at
    ),''
  );
  return v_row;
end;
$$;

revoke all on function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz,text,timestamptz) from public, anon;
grant execute on function public.set_platform_admin_authorization(uuid,text,jsonb,text,timestamptz,text,timestamptz) to authenticated;

create or replace function private.institution_permissions_are_valid(
  p_role text,
  p_permissions jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_role in ('owner','admin','security','records')
    and jsonb_typeof(coalesce(p_permissions,'{}'::jsonb))='object'
    and not exists (
      select 1 from jsonb_each(coalesce(p_permissions,'{}'::jsonb)) permission
      where permission.key <> all(array[
        'view_control_center','view_accounts','control_features','view_integrations',
        'manage_integrations','test_integrations','view_audit','export_reports',
        'manage_team','manage_affiliations','manage_institution_profile',
        'view_security','view_records','manage_retention','manage_courses'
      ]::text[])
      or jsonb_typeof(permission.value)<>'boolean'
      or (
        permission.value='true'::jsonb
        and not case p_role
          when 'owner' then true
          when 'admin' then true
          when 'security' then permission.key = any(array[
            'view_control_center','view_integrations','test_integrations','view_audit','view_security'
          ]::text[])
          when 'records' then permission.key = any(array[
            'view_control_center','view_accounts','view_audit','export_reports','view_records','manage_retention'
          ]::text[])
          else false
        end
      )
    );
$$;

create or replace function private.can_grant_institution_permissions(
  p_institution_id uuid,
  p_target_role text,
  p_permissions jsonb,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.institution_permissions_are_valid(p_target_role,p_permissions)
    and (
      private.is_platform_owner(p_actor_id)
      or (
        private.has_institution_capability(p_institution_id,'manage_team',p_actor_id)
        and not (p_target_role='owner')
        and not (
          p_target_role='admin'
          and not exists (
            select 1 from public.institution_memberships actor_membership
            where actor_membership.institution_id=p_institution_id
              and actor_membership.user_id=p_actor_id
              and actor_membership.status='active'
              and actor_membership.role='owner'
          )
        )
        and not exists (
          select 1
          from unnest(array[
            'view_control_center','view_accounts','control_features','view_integrations',
            'manage_integrations','test_integrations','view_audit','export_reports',
            'manage_team','manage_affiliations','manage_institution_profile',
            'view_security','view_records','manage_retention','manage_courses'
          ]::text[]) capability
          where (
            private.institution_role_baseline_capability(p_target_role,capability)
            or coalesce(p_permissions,'{}'::jsonb) @> jsonb_build_object(capability,true)
          )
          and not private.has_institution_capability(p_institution_id,capability,p_actor_id)
        )
      )
    );
$$;

revoke all on function private.institution_permissions_are_valid(text,jsonb) from public;
revoke all on function private.can_grant_institution_permissions(uuid,text,jsonb,uuid) from public;
grant execute on function private.institution_permissions_are_valid(text,jsonb) to authenticated;
grant execute on function private.can_grant_institution_permissions(uuid,text,jsonb,uuid) to authenticated;

create or replace function public.invite_institution_team_member(
  p_institution_id uuid,
  p_email text,
  p_role text,
  p_permissions jsonb default '{}'::jsonb
)
returns public.institution_team_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.institution_team_invitations;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_role not in ('admin','security','records') then raise exception 'Only institution admin, security, or records roles can be invited here'; end if;
  if not private.can_grant_institution_permissions(p_institution_id,p_role,coalesce(p_permissions,'{}'::jsonb),(select auth.uid())) then
    raise exception 'The requested role or permissions exceed your institution-team authority';
  end if;
  if lower(trim(coalesce(p_email,''))) !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  insert into public.institution_team_invitations(institution_id,email,intended_role,permissions,invited_by)
  values(p_institution_id,lower(trim(p_email)),p_role,coalesce(p_permissions,'{}'::jsonb),(select auth.uid()))
  returning * into v_row;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'institution.team_invited','institution_team_invitation',v_row.id::text,
    jsonb_build_object('role',p_role,'permissions',coalesce(p_permissions,'{}'::jsonb),'email_domain',split_part(v_row.email,'@',2)), '');
  return v_row;
end;
$$;

create or replace function public.accept_institution_team_invitation(p_invitation_id uuid)
returns public.institution_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.institution_team_invitations%rowtype;
  v_profile public.profiles%rowtype;
  v_member public.institution_memberships;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_profile from public.profiles where id=(select auth.uid());
  select * into v_invite from public.institution_team_invitations where id=p_invitation_id for update;
  if not found or v_invite.status<>'pending' or v_invite.expires_at<=now() then raise exception 'Invitation is not available'; end if;
  if lower(coalesce(v_profile.email,''))<>lower(v_invite.email) then raise exception 'Sign in with the invited email address'; end if;
  if not private.can_grant_institution_permissions(v_invite.institution_id,v_invite.intended_role,v_invite.permissions,v_invite.invited_by) then
    raise exception 'The invitation no longer has a valid authorizer or permission set';
  end if;
  insert into public.institution_memberships(institution_id,user_id,role,status,permissions,invited_by,joined_at)
  values(v_invite.institution_id,v_profile.id,v_invite.intended_role,'active',v_invite.permissions,v_invite.invited_by,now())
  on conflict(institution_id,user_id) do update set role=excluded.role,status='active',permissions=excluded.permissions,
    invited_by=excluded.invited_by,joined_at=coalesce(public.institution_memberships.joined_at,now()),ended_at=null
  returning * into v_member;
  update public.institution_team_invitations set status='accepted',accepted_by=v_profile.id,accepted_at=now(),updated_at=now() where id=p_invitation_id;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_profile.id,v_invite.institution_id,'institution.team_invitation_accepted','institution_membership',v_profile.id::text,
    jsonb_build_object('role',v_member.role,'permissions',v_member.permissions),'');
  return v_member;
end;
$$;

create or replace function public.set_institution_team_member(
  p_institution_id uuid,
  p_user_id uuid,
  p_role text,
  p_permissions jsonb,
  p_status text
)
returns public.institution_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.institution_memberships%rowtype;
  v_row public.institution_memberships;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_target from public.institution_memberships where institution_id=p_institution_id and user_id=p_user_id for update;
  if not found then raise exception 'Institution team member not found'; end if;
  if p_user_id=(select auth.uid()) and not private.is_platform_owner((select auth.uid())) then
    raise exception 'Team members cannot change their own role, permissions, or status';
  end if;
  if v_target.role='owner' and not private.is_platform_owner((select auth.uid())) then raise exception 'Institution ownership cannot be changed here'; end if;
  if p_status not in ('active','suspended','ended') then raise exception 'Invalid team status'; end if;
  if not private.can_grant_institution_permissions(p_institution_id,p_role,coalesce(p_permissions,'{}'::jsonb),(select auth.uid())) then
    raise exception 'The requested role or permissions exceed your institution-team authority';
  end if;
  update public.institution_memberships
  set role=p_role,permissions=coalesce(p_permissions,'{}'::jsonb),status=p_status,
      ended_at=case when p_status='ended' then now() else null end
  where institution_id=p_institution_id and user_id=p_user_id returning * into v_row;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'institution.team_member_changed','institution_membership',p_user_id::text,
    jsonb_build_object('role',p_role,'status',p_status,'permissions',coalesce(p_permissions,'{}'::jsonb),
      'previous_role',v_target.role,'previous_status',v_target.status,'previous_permissions',v_target.permissions),'');
  return v_row;
end;
$$;

revoke all on function public.invite_institution_team_member(uuid,text,text,jsonb) from public, anon;
revoke all on function public.accept_institution_team_invitation(uuid) from public, anon;
revoke all on function public.set_institution_team_member(uuid,uuid,text,jsonb,text) from public, anon;
grant execute on function public.invite_institution_team_member(uuid,text,text,jsonb) to authenticated;
grant execute on function public.accept_institution_team_invitation(uuid) to authenticated;
grant execute on function public.set_institution_team_member(uuid,uuid,text,jsonb,text) to authenticated;

create or replace function public.update_institution_profile(
  p_institution_id uuid,
  p_patch jsonb,
  p_reason text
)
returns public.institutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.institutions%rowtype;
  v_row public.institutions;
  v_key text;
  v_timezone text;
begin
  if not private.has_institution_capability(p_institution_id,'manage_institution_profile',(select auth.uid())) then
    raise exception 'Institution profile-management access required';
  end if;
  if jsonb_typeof(coalesce(p_patch,'{}'::jsonb))<>'object' then raise exception 'Profile changes must be a JSON object'; end if;
  for v_key in select key from jsonb_each(coalesce(p_patch,'{}'::jsonb)) loop
    if v_key <> all(array['name','primary_lms','academic_domain','timezone_name','default_retention_days']::text[]) then
      raise exception 'Institution field cannot be changed here: %',v_key;
    end if;
  end loop;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason))<5 then raise exception 'A reason of at least 5 characters is required'; end if;
  select * into v_existing from public.institutions where id=p_institution_id for update;
  if not found then raise exception 'Institution not found'; end if;
  v_timezone := coalesce(nullif(trim(p_patch->>'timezone_name'),''),v_existing.timezone_name);
  if not exists(select 1 from pg_catalog.pg_timezone_names t where t.name=v_timezone) then raise exception 'Unknown timezone'; end if;
  if p_patch ? 'default_retention_days' and (
    jsonb_typeof(p_patch->'default_retention_days')<>'number'
    or (p_patch->>'default_retention_days')::integer not between 0 and 36500
  ) then raise exception 'Default retention days must be from 0 to 36500'; end if;
  update public.institutions set
    name=case when p_patch?'name' then left(trim(p_patch->>'name'),180) else name end,
    primary_lms=case when p_patch?'primary_lms' then nullif(left(trim(p_patch->>'primary_lms'),120),'') else primary_lms end,
    academic_domain=case when p_patch?'academic_domain' then nullif(lower(left(trim(p_patch->>'academic_domain'),255)),'') else academic_domain end,
    timezone_name=v_timezone,
    default_retention_days=case when p_patch?'default_retention_days' then (p_patch->>'default_retention_days')::integer else default_retention_days end,
    updated_at=now()
  where id=p_institution_id returning * into v_row;
  if char_length(trim(v_row.name))<2 then raise exception 'Institution name must have at least 2 characters'; end if;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'institution.profile_changed','institution',p_institution_id::text,
    jsonb_build_object('fields',(select jsonb_agg(key order by key) from jsonb_each(coalesce(p_patch,'{}'::jsonb))),
      'reason',left(trim(p_reason),1000)), '');
  return v_row;
end;
$$;

create or replace function private.can_manage_data_governance(
  p_institution_id uuid,
  p_course_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and (
    private.is_platform_owner(p_user_id)
    or (
      p_institution_id is not null
      and private.has_institution_capability(p_institution_id,'manage_retention',p_user_id)
      and (p_course_id is null or exists(select 1 from public.courses c where c.id=p_course_id and c.institution_id=p_institution_id))
    )
    or (
      p_institution_id is null and p_course_id is not null
      and exists(select 1 from public.courses c where c.id=p_course_id and c.institution_id is null)
      and private.can_manage_course(p_course_id)
    )
  );
$$;

create or replace function public.upsert_retention_policy(
  p_policy_id uuid,
  p_institution_id uuid,
  p_course_id uuid,
  p_name text,
  p_purpose text,
  p_retention_days integer,
  p_resource_types text[],
  p_disposition text,
  p_active boolean,
  p_reason text
)
returns public.retention_policies
language plpgsql
security definer
set search_path = ''
as $$
declare v_existing public.retention_policies%rowtype; v_row public.retention_policies;
begin
  if not private.can_manage_data_governance(p_institution_id,p_course_id,(select auth.uid())) then raise exception 'Retention-management access required for this scope'; end if;
  if nullif(trim(p_name),'') is null or char_length(trim(p_name))>180 then raise exception 'A retention policy name is required'; end if;
  if p_retention_days not between 0 and 36500 then raise exception 'Retention days must be from 0 to 36500'; end if;
  if p_disposition not in ('delete','archive','review') then raise exception 'Invalid disposition'; end if;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason))<5 then raise exception 'A reason of at least 5 characters is required'; end if;
  if p_policy_id is not null then
    select * into v_existing from public.retention_policies where id=p_policy_id for update;
    if not found then raise exception 'Retention policy not found'; end if;
    if not private.can_manage_data_governance(v_existing.institution_id,v_existing.course_id,(select auth.uid())) then raise exception 'Existing retention scope is not manageable'; end if;
    update public.retention_policies set institution_id=p_institution_id,course_id=p_course_id,name=trim(p_name),purpose=nullif(trim(p_purpose),''),
      retention_days=p_retention_days,resource_types=coalesce(p_resource_types,'{}'::text[]),disposition=p_disposition,active=coalesce(p_active,true),updated_at=now()
    where id=p_policy_id returning * into v_row;
  else
    insert into public.retention_policies(institution_id,course_id,name,purpose,retention_days,resource_types,disposition,active,created_by)
    values(p_institution_id,p_course_id,trim(p_name),nullif(trim(p_purpose),''),p_retention_days,coalesce(p_resource_types,'{}'::text[]),p_disposition,coalesce(p_active,true),(select auth.uid()))
    returning * into v_row;
  end if;
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_row.institution_id,v_row.course_id,'retention.policy_changed','retention_policy',v_row.id::text,
    jsonb_build_object('retention_days',v_row.retention_days,'disposition',v_row.disposition,'active',v_row.active,'reason',left(trim(p_reason),1000)), '');
  return v_row;
end;
$$;

create or replace function public.upsert_legal_hold(
  p_hold_id uuid,
  p_institution_id uuid,
  p_course_id uuid,
  p_name text,
  p_hold_reason text,
  p_scope jsonb,
  p_change_reason text
)
returns public.legal_holds
language plpgsql
security definer
set search_path = ''
as $$
declare v_existing public.legal_holds%rowtype; v_row public.legal_holds;
begin
  if not private.can_manage_data_governance(p_institution_id,p_course_id,(select auth.uid())) then raise exception 'Legal-hold management access required for this scope'; end if;
  if nullif(trim(p_name),'') is null or char_length(trim(p_name))>180 then raise exception 'A legal-hold name is required'; end if;
  if nullif(trim(p_hold_reason),'') is null or char_length(trim(p_hold_reason))>2000 then raise exception 'A legal-hold reason is required'; end if;
  if jsonb_typeof(coalesce(p_scope,'{}'::jsonb))<>'object' then raise exception 'Legal-hold scope must be a JSON object'; end if;
  if nullif(trim(p_change_reason),'') is null or char_length(trim(p_change_reason))<5 then raise exception 'A change reason of at least 5 characters is required'; end if;
  if p_hold_id is not null then
    select * into v_existing from public.legal_holds where id=p_hold_id for update;
    if not found then raise exception 'Legal hold not found'; end if;
    if not v_existing.active then raise exception 'A released legal hold cannot be changed'; end if;
    if not private.can_manage_data_governance(v_existing.institution_id,v_existing.course_id,(select auth.uid())) then raise exception 'Existing legal-hold scope is not manageable'; end if;
    update public.legal_holds set institution_id=p_institution_id,course_id=p_course_id,name=trim(p_name),reason=trim(p_hold_reason),scope=coalesce(p_scope,'{}'::jsonb),updated_at=now()
    where id=p_hold_id returning * into v_row;
  else
    insert into public.legal_holds(institution_id,course_id,name,reason,scope,active,created_by)
    values(p_institution_id,p_course_id,trim(p_name),trim(p_hold_reason),coalesce(p_scope,'{}'::jsonb),true,(select auth.uid()))
    returning * into v_row;
  end if;
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_row.institution_id,v_row.course_id,'legal_hold.changed','legal_hold',v_row.id::text,
    jsonb_build_object('active',v_row.active,'change_reason',left(trim(p_change_reason),1000)), '');
  return v_row;
end;
$$;

create or replace function public.release_legal_hold(p_hold_id uuid,p_reason text)
returns public.legal_holds
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.legal_holds;
begin
  select * into v_row from public.legal_holds where id=p_hold_id for update;
  if not found then raise exception 'Legal hold not found'; end if;
  if not private.can_manage_data_governance(v_row.institution_id,v_row.course_id,(select auth.uid())) then raise exception 'Legal-hold management access required'; end if;
  if not v_row.active then raise exception 'Legal hold is already released'; end if;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason))<5 then raise exception 'A release reason of at least 5 characters is required'; end if;
  update public.legal_holds set active=false,released_at=now(),updated_at=now() where id=p_hold_id returning * into v_row;
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_row.institution_id,v_row.course_id,'legal_hold.released','legal_hold',v_row.id::text,
    jsonb_build_object('reason',left(trim(p_reason),1000)), '');
  return v_row;
end;
$$;

create or replace function public.set_legal_hold_file(
  p_hold_id uuid,
  p_secure_file_id uuid,
  p_attached boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_hold public.legal_holds%rowtype; v_file public.secure_file_objects%rowtype;
begin
  select * into v_hold from public.legal_holds where id=p_hold_id for update;
  if not found or not v_hold.active then raise exception 'Active legal hold not found'; end if;
  if not private.can_manage_data_governance(v_hold.institution_id,v_hold.course_id,(select auth.uid())) then raise exception 'Legal-hold management access required'; end if;
  select * into v_file from public.secure_file_objects where id=p_secure_file_id;
  if not found then raise exception 'Secure file not found'; end if;
  if v_hold.institution_id is not null and v_file.institution_id is distinct from v_hold.institution_id then raise exception 'The file is outside the legal hold institution'; end if;
  if v_hold.course_id is not null and v_file.course_id is distinct from v_hold.course_id then raise exception 'The file is outside the legal hold course'; end if;
  if nullif(trim(p_reason),'') is null or char_length(trim(p_reason))<5 then raise exception 'A reason of at least 5 characters is required'; end if;
  if p_attached then
    insert into public.legal_hold_files(legal_hold_id,secure_file_id,added_by)
    values(p_hold_id,p_secure_file_id,(select auth.uid())) on conflict do nothing;
  else
    delete from public.legal_hold_files where legal_hold_id=p_hold_id and secure_file_id=p_secure_file_id;
  end if;
  insert into public.audit_events(actor_id,institution_id,course_id,secure_file_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_hold.institution_id,v_hold.course_id,p_secure_file_id,
    case when p_attached then 'legal_hold.file_attached' else 'legal_hold.file_detached' end,
    'legal_hold',p_hold_id::text,jsonb_build_object('reason',left(trim(p_reason),1000)), '');
  return jsonb_build_object('legal_hold_id',p_hold_id,'secure_file_id',p_secure_file_id,'attached',p_attached);
end;
$$;

revoke all on function private.can_manage_data_governance(uuid,uuid,uuid) from public;
grant execute on function private.can_manage_data_governance(uuid,uuid,uuid) to authenticated;
revoke all on function public.update_institution_profile(uuid,jsonb,text) from public, anon;
revoke all on function public.upsert_retention_policy(uuid,uuid,uuid,text,text,integer,text[],text,boolean,text) from public, anon;
revoke all on function public.upsert_legal_hold(uuid,uuid,uuid,text,text,jsonb,text) from public, anon;
revoke all on function public.release_legal_hold(uuid,text) from public, anon;
revoke all on function public.set_legal_hold_file(uuid,uuid,boolean,text) from public, anon;
grant execute on function public.update_institution_profile(uuid,jsonb,text) to authenticated;
grant execute on function public.upsert_retention_policy(uuid,uuid,uuid,text,text,integer,text[],text,boolean,text) to authenticated;
grant execute on function public.upsert_legal_hold(uuid,uuid,uuid,text,text,jsonb,text) to authenticated;
grant execute on function public.release_legal_hold(uuid,text) to authenticated;
grant execute on function public.set_legal_hold_file(uuid,uuid,boolean,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cross-tenant writable-reference invariants
-- ---------------------------------------------------------------------------

create or replace function private.enforce_course_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.institution_id is null and new.access_scope not in ('independent','public_free') then
    raise exception 'A course without an institution must be independent or public-free';
  end if;
  if new.institution_id is not null and new.access_scope<>'institution' then
    raise exception 'An institution course must use institution access scope';
  end if;
  if new.institution_id is not null and not private.has_active_institution_affiliation(new.owner_id,new.institution_id,'professor') then
    raise exception 'The course owner must have an active professor affiliation with the institution';
  end if;
  if tg_op='UPDATE' and (new.institution_id is distinct from old.institution_id or new.owner_id is distinct from old.owner_id) then
    if (select auth.uid()) is not null and not private.is_platform_owner((select auth.uid())) then
      raise exception 'Course ownership or institution changes require platform-owner review';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_course_membership_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_course public.courses%rowtype;
begin
  if tg_op='UPDATE' and (new.course_id is distinct from old.course_id or new.user_id is distinct from old.user_id) then
    raise exception 'Course membership identity is immutable; remove and add the membership instead';
  end if;
  select * into v_course from public.courses where id=new.course_id;
  if not found then raise exception 'Course not found'; end if;
  if new.role='owner' and new.user_id is distinct from v_course.owner_id then raise exception 'Only the course owner can hold the owner membership'; end if;
  if new.user_id=v_course.owner_id and new.role<>'owner' then raise exception 'The course owner membership cannot be downgraded'; end if;
  if v_course.institution_id is not null then
    if new.role='learner' and not private.has_active_institution_affiliation(new.user_id,v_course.institution_id,'student') then
      raise exception 'Learner membership requires an active student affiliation with the course institution';
    elsif new.role='professor' and not private.has_active_institution_affiliation(new.user_id,v_course.institution_id,'professor') then
      raise exception 'Professor membership requires an active professor affiliation with the course institution';
    elsif new.role='publisher' and not private.has_active_institution_affiliation(new.user_id,v_course.institution_id,'publisher') then
      raise exception 'Publisher membership requires an active publisher affiliation with the course institution';
    elsif new.role='owner' and not private.has_active_institution_affiliation(new.user_id,v_course.institution_id,'professor') then
      raise exception 'Course ownership requires an active professor affiliation with the course institution';
    elsif new.role='admin' and not (
      private.has_active_institution_affiliation(new.user_id,v_course.institution_id,'professor')
      or exists(select 1 from public.institution_memberships im where im.institution_id=v_course.institution_id and im.user_id=new.user_id and im.status='active' and im.role in ('owner','admin'))
    ) then raise exception 'Course administration requires an active institution administrator or professor relationship';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_grade_item_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists(select 1 from public.grade_categories gc where gc.id=new.category_id and gc.course_id=new.course_id) then
    raise exception 'Grade category is outside the grade item course';
  end if;
  if new.assignment_id is not null and not exists(select 1 from public.assignments a where a.id=new.assignment_id and a.course_id=new.course_id) then
    raise exception 'Assignment is outside the grade item course';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_student_grade_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.grade_items%rowtype; v_course public.courses%rowtype;
begin
  if tg_op='UPDATE' and (
    new.course_id is distinct from old.course_id or new.grade_item_id is distinct from old.grade_item_id or new.student_id is distinct from old.student_id
  ) then raise exception 'Grade course, item, and student are immutable'; end if;
  select * into v_item from public.grade_items where id=new.grade_item_id;
  if not found or v_item.course_id is distinct from new.course_id then raise exception 'Grade item is outside the student grade course'; end if;
  select * into v_course from public.courses where id=new.course_id;
  if not exists(select 1 from public.course_memberships cm where cm.course_id=new.course_id and cm.user_id=new.student_id and cm.role='learner') then
    raise exception 'A grade requires an active learner course membership';
  end if;
  if v_course.institution_id is not null and not private.has_active_institution_affiliation(new.student_id,v_course.institution_id,'student') then
    raise exception 'A grade requires an active student affiliation with the course institution';
  end if;
  if new.score is not null and (new.score<0 or new.score>v_item.max_points) then raise exception 'Grade score must be between zero and the grade item maximum'; end if;
  if new.status='finalized' and new.score is null then raise exception 'A finalized grade requires a score'; end if;
  return new;
end;
$$;

create or replace function private.enforce_roster_entry_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_course public.courses%rowtype;
begin
  if tg_op='UPDATE' and (
    new.course_id is distinct from old.course_id or new.added_by is distinct from old.added_by or new.identifier_hash is distinct from old.identifier_hash
  ) then raise exception 'Roster course, creator, and protected identifier are immutable'; end if;
  select * into v_course from public.courses where id=new.course_id;
  if not found then raise exception 'Roster course not found'; end if;
  if new.match_status='approved' and new.matched_user_id is null then raise exception 'An approved roster entry requires a matched account'; end if;
  if new.matched_user_id is not null and v_course.institution_id is not null
    and not private.has_active_institution_affiliation(new.matched_user_id,v_course.institution_id,'student') then
    raise exception 'The matched student is outside the roster institution';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_enrollment_request_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_course public.courses%rowtype; v_roster public.student_roster_entries%rowtype;
begin
  if tg_op='UPDATE' and (
    new.course_id is distinct from old.course_id or new.student_id is distinct from old.student_id or new.roster_entry_id is distinct from old.roster_entry_id
  ) then raise exception 'Enrollment course, student, and roster link are immutable'; end if;
  select * into v_course from public.courses where id=new.course_id;
  if not found then raise exception 'Enrollment course not found'; end if;
  if v_course.institution_id is not null and not private.has_active_institution_affiliation(new.student_id,v_course.institution_id,'student') then
    raise exception 'Enrollment requires an active student affiliation with the course institution';
  end if;
  if new.roster_entry_id is not null then
    select * into v_roster from public.student_roster_entries where id=new.roster_entry_id;
    if not found or v_roster.course_id is distinct from new.course_id then raise exception 'Roster entry is outside the enrollment course'; end if;
    if v_roster.matched_user_id is not null and v_roster.matched_user_id is distinct from new.student_id then raise exception 'Roster entry is matched to another student'; end if;
  end if;
  if tg_op='INSERT' and new.status<>'pending' then raise exception 'New enrollment requests must start pending'; end if;
  if new.status='pending' and (new.approved_by is not null or new.decided_at is not null) then raise exception 'A pending enrollment cannot contain a decision'; end if;
  if new.status='approved' and (new.approved_by is null or new.decided_at is null) then raise exception 'An approved enrollment requires an approver and decision time'; end if;
  if new.status='rejected' and new.decided_at is null then raise exception 'A rejected enrollment requires a decision time'; end if;
  return new;
end;
$$;

create or replace function private.enforce_assignment_draft_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' and (
    new.assignment_id is distinct from old.assignment_id
    or new.student_id is distinct from old.student_id
  ) then
    raise exception 'Assignment draft identity and assignment scope are immutable';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_learning_resource_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'Learning-resource ownership is immutable';
  end if;
  if new.secure_file_id is not null
     and (tg_op='INSERT' or new.secure_file_id is distinct from old.secure_file_id)
     and (select auth.uid()) is not null
     and not private.can_access_secure_file(new.secure_file_id,(select auth.uid())) then
    raise exception 'Learning-resource secure-file access required';
  end if;
  if new.assignment_id is not null and new.course_id is not null and not exists (
    select 1 from public.assignments a where a.id=new.assignment_id and a.course_id=new.course_id
  ) then raise exception 'Learning-resource assignment is outside its course'; end if;
  if new.publication_id is not null and new.course_id is not null and not exists (
    select 1 from public.publications p where p.id=new.publication_id and p.course_id=new.course_id
  ) then raise exception 'Learning-resource publication is outside its course'; end if;
  if (
    tg_op='INSERT'
    or (
      tg_op='UPDATE'
      and (
        new.course_id is distinct from old.course_id
        or new.assignment_id is distinct from old.assignment_id
        or new.publication_id is distinct from old.publication_id
      )
    )
  ) and (select auth.uid()) is not null then
    if new.course_id is not null and not private.can_access_course(new.course_id) then
      raise exception 'Learning-resource target course access required';
    end if;
    if new.assignment_id is not null and not private.can_access_assignment(new.assignment_id) then
      raise exception 'Learning-resource target assignment access required';
    end if;
    if new.publication_id is not null and not private.can_access_publication(new.publication_id,(select auth.uid())) then
      raise exception 'Learning-resource target publication access required';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_student_group_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' and (
    new.created_by is distinct from old.created_by
    or new.course_id is distinct from old.course_id
    or new.institution_id is distinct from old.institution_id
  ) then raise exception 'Student-group ownership and institution/course context are immutable'; end if;
  if new.course_id is not null and new.institution_id is not null and not exists (
    select 1 from public.courses c where c.id=new.course_id and c.institution_id=new.institution_id
  ) then raise exception 'Student group course is outside its institution'; end if;
  return new;
end;
$$;

create or replace function private.enforce_student_post_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op='UPDATE' and (
    new.group_id is distinct from old.group_id or new.author_id is distinct from old.author_id
  ) then raise exception 'Student-post author and group context are immutable'; end if;
  return new;
end;
$$;

create or replace function private.enforce_course_lesson_progress_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_pub public.course_publications%rowtype; v_manifest jsonb;
begin
  if tg_op='UPDATE' and (
    new.publication_id is distinct from old.publication_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id
    or new.path_id is distinct from old.path_id
    or new.lesson_id is distinct from old.lesson_id
  ) then raise exception 'Lesson-progress identity and course scope are immutable'; end if;
  select * into v_pub from public.course_publications where id=new.publication_id;
  if not found or v_pub.course_id is distinct from new.course_id then raise exception 'Lesson progress is outside its publication course'; end if;
  if not exists (
    select 1 from public.course_memberships cm
    where cm.course_id=new.course_id and cm.user_id=new.user_id and cm.role='learner'
      and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
  ) then raise exception 'Lesson progress requires a current learner course membership'; end if;
  select cpv.manifest into v_manifest from public.course_publication_versions cpv
  where cpv.publication_id=new.publication_id and cpv.version_number=new.version_number;
  if v_manifest is null or not exists (
    select 1
    from jsonb_array_elements(v_manifest->'paths') path
    cross join jsonb_array_elements(path->'nodes') node
    where path->>'id'=new.path_id and node->>'id'=new.lesson_id
  ) then raise exception 'Lesson progress does not match the publication manifest version'; end if;
  if new.auto_score is not null and (new.auto_score<0 or new.auto_score>100) then raise exception 'Lesson automatic score must be from zero to 100'; end if;
  if new.status='completed' and (new.completed_at is null or new.auto_score is null) then
    raise exception 'Completed lesson progress requires a server-calculated score and completion time';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_course_progress_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_pub public.course_publications%rowtype; v_manifest jsonb; v_total integer;
begin
  if tg_op='UPDATE' and (
    new.publication_id is distinct from old.publication_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id
  ) then raise exception 'Course-progress identity and course scope are immutable'; end if;
  select * into v_pub from public.course_publications where id=new.publication_id;
  if not found or v_pub.course_id is distinct from new.course_id then raise exception 'Course progress is outside its publication course'; end if;
  if not exists (
    select 1 from public.course_memberships cm
    where cm.course_id=new.course_id and cm.user_id=new.user_id and cm.role='learner'
      and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
  ) then raise exception 'Course progress requires a current learner course membership'; end if;
  select cpv.manifest into v_manifest from public.course_publication_versions cpv
  where cpv.publication_id=new.publication_id and cpv.version_number=new.version_number;
  if v_manifest is null then raise exception 'Course progress does not match a publication manifest version'; end if;
  select coalesce(sum(jsonb_array_length(path->'nodes')),0)::integer into v_total
  from jsonb_array_elements(v_manifest->'paths') path;
  if new.total_lessons<>v_total or new.completed_lessons>v_total then raise exception 'Course progress lesson totals do not match the manifest'; end if;
  if new.current_path_id is not null and new.current_lesson_id is not null and not exists (
    select 1 from jsonb_array_elements(v_manifest->'paths') path
    cross join jsonb_array_elements(path->'nodes') node
    where path->>'id'=new.current_path_id and node->>'id'=new.current_lesson_id
  ) then raise exception 'Current lesson is outside the course manifest'; end if;
  if new.completion_percent<0 or new.completion_percent>100
     or (new.auto_score is not null and (new.auto_score<0 or new.auto_score>100))
     or (new.final_score is not null and (new.final_score<0 or new.final_score>100)) then
    raise exception 'Course progress scores and percentages must be from zero to 100';
  end if;
  if new.grade_status in ('auto_graded','graded') and new.final_score is null then
    raise exception 'Finalized course progress requires a final score';
  end if;
  return new;
end;
$$;

create or replace function private.grade_share_viewer_has_scope(
  p_grade_share_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.grade_share_links gsl
    where gsl.id=p_grade_share_id and gsl.viewer_id=p_user_id
      and gsl.revoked_at is null and gsl.expires_at>now()
      and not exists (
        select 1
        from unnest(gsl.scope_course_ids) scoped_course
        join public.courses c on c.id=scoped_course
        where not exists (
          select 1 from public.course_memberships cm
          where cm.course_id=scoped_course and cm.user_id=gsl.student_id and cm.role='learner'
            and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
        )
        or (
          c.institution_id is not null
          and not (
            private.has_active_institution_affiliation(p_user_id,c.institution_id,null)
            or exists(select 1 from public.institution_memberships im where im.institution_id=c.institution_id and im.user_id=p_user_id and im.status='active')
          )
        )
      )
  );
$$;

create or replace function private.enforce_grade_share_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_scope_count integer; v_distinct_count integer;
begin
  if tg_op='UPDATE' and (new.student_id is distinct from old.student_id or new.token_hash is distinct from old.token_hash) then
    raise exception 'Grade-share owner and token are immutable';
  end if;
  select count(*),count(distinct course_id) into v_scope_count,v_distinct_count from unnest(new.scope_course_ids) course_id;
  if v_scope_count=0 or v_scope_count<>v_distinct_count or exists(select 1 from unnest(new.scope_course_ids) course_id where course_id is null) then
    raise exception 'Grade-share course scope must contain unique course identifiers';
  end if;
  if exists(
    select 1 from unnest(new.scope_course_ids) scoped_course
    where not exists(
      select 1 from public.course_memberships cm
      where cm.course_id=scoped_course and cm.user_id=new.student_id and cm.role='learner'
        and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
    )
  ) then raise exception 'Grade-share scope includes a course the student is not enrolled in'; end if;
  if exists(
    select 1 from unnest(new.scope_course_ids) scoped_course
    join public.courses c on c.id=scoped_course
    where c.institution_id is not null
      and (
        new.viewer_id is null
        or not (
          private.has_active_institution_affiliation(new.viewer_id,c.institution_id,null)
          or exists(select 1 from public.institution_memberships im where im.institution_id=c.institution_id and im.user_id=new.viewer_id and im.status='active')
        )
      )
  ) then raise exception 'Institution grade shares require a viewer in the same institution'; end if;
  return new;
end;
$$;

-- Fail closed before installing the guards. The checks disclose only a domain
-- and row count so a production migration can be investigated without putting
-- student identifiers or grade values in deployment logs.
do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.courses c
  where (c.institution_id is null and c.access_scope not in ('independent','public_free'))
     or (c.institution_id is not null and c.access_scope<>'institution')
     or (c.institution_id is not null and not private.has_active_institution_affiliation(c.owner_id,c.institution_id,'professor'));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: courses contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.course_memberships cm
  join public.courses c on c.id=cm.course_id
  where (cm.role='owner' and cm.user_id is distinct from c.owner_id)
     or (cm.user_id=c.owner_id and cm.role<>'owner')
     or (c.institution_id is not null and not private.course_membership_is_current(cm.course_id,cm.user_id,cm.role));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: course memberships contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.grade_items gi
  where (gi.category_id is not null and not exists(
           select 1 from public.grade_categories gc where gc.id=gi.category_id and gc.course_id=gi.course_id
        ))
     or (gi.assignment_id is not null and not exists(
           select 1 from public.assignments a where a.id=gi.assignment_id and a.course_id=gi.course_id
        ));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: grade items contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.student_grades sg
  join public.grade_items gi on gi.id=sg.grade_item_id
  join public.courses c on c.id=sg.course_id
  where gi.course_id is distinct from sg.course_id
     or not exists(
          select 1 from public.course_memberships cm
          where cm.course_id=sg.course_id and cm.user_id=sg.student_id and cm.role='learner'
            and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
        )
     or (c.institution_id is not null and not private.has_active_institution_affiliation(sg.student_id,c.institution_id,'student'))
     or (sg.score is not null and (sg.score<0 or sg.score>gi.max_points))
     or (sg.status='finalized' and sg.score is null);
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: student grades contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.student_roster_entries sre
  join public.courses c on c.id=sre.course_id
  where (sre.match_status='approved' and sre.matched_user_id is null)
     or (sre.matched_user_id is not null and c.institution_id is not null
         and not private.has_active_institution_affiliation(sre.matched_user_id,c.institution_id,'student'));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: roster matches contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.student_enrollment_requests ser
  join public.courses c on c.id=ser.course_id
  left join public.student_roster_entries sre on sre.id=ser.roster_entry_id
  where (c.institution_id is not null and not private.has_active_institution_affiliation(ser.student_id,c.institution_id,'student'))
     or (ser.roster_entry_id is not null and (sre.id is null or sre.course_id is distinct from ser.course_id))
     or (sre.matched_user_id is not null and sre.matched_user_id is distinct from ser.student_id)
     or (ser.status='pending' and (ser.approved_by is not null or ser.decided_at is not null))
     or (ser.status='approved' and (ser.approved_by is null or ser.decided_at is null))
     or (ser.status='rejected' and ser.decided_at is null);
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: enrollment links contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.learning_resources lr
  where (lr.assignment_id is not null and lr.course_id is not null and not exists(
           select 1 from public.assignments a where a.id=lr.assignment_id and a.course_id=lr.course_id
        ))
     or (lr.publication_id is not null and lr.course_id is not null and not exists(
           select 1 from public.publications p where p.id=lr.publication_id and p.course_id=lr.course_id
        ))
     or (lr.secure_file_id is not null and exists(
           select 1 from public.secure_file_objects sf
           where sf.id=lr.secure_file_id
             and ((lr.course_id is not null and sf.course_id is not null and sf.course_id<>lr.course_id)
               or (lr.assignment_id is not null and sf.assignment_id is not null and sf.assignment_id<>lr.assignment_id))
        ));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: learning resources contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.student_groups sg
  where sg.course_id is not null and sg.institution_id is not null and not exists(
    select 1 from public.courses c where c.id=sg.course_id and c.institution_id=sg.institution_id
  );
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: student groups contain % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.course_lesson_progress clp
  join public.course_publications cp on cp.id=clp.publication_id
  left join public.course_publication_versions cpv
    on cpv.publication_id=clp.publication_id and cpv.version_number=clp.version_number
  where cp.course_id is distinct from clp.course_id
     or cpv.publication_id is null
     or not exists(
          select 1 from public.course_memberships cm
          where cm.course_id=clp.course_id and cm.user_id=clp.user_id and cm.role='learner'
        )
     or not exists(
          select 1 from jsonb_array_elements(cpv.manifest->'paths') path
          cross join jsonb_array_elements(path->'nodes') node
          where path->>'id'=clp.path_id and node->>'id'=clp.lesson_id
        )
     or (clp.auto_score is not null and (clp.auto_score<0 or clp.auto_score>100))
     or (clp.status='completed' and (clp.completed_at is null or clp.auto_score is null));
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: lesson progress contains % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.course_progress cpr
  join public.course_publications cp on cp.id=cpr.publication_id
  left join public.course_publication_versions cpv
    on cpv.publication_id=cpr.publication_id and cpv.version_number=cpr.version_number
  where cp.course_id is distinct from cpr.course_id
     or cpv.publication_id is null
     or not exists(
          select 1 from public.course_memberships cm
          where cm.course_id=cpr.course_id and cm.user_id=cpr.user_id and cm.role='learner'
        )
     or cpr.total_lessons is distinct from (
          select coalesce(sum(jsonb_array_length(path->'nodes')),0)::integer
          from jsonb_array_elements(cpv.manifest->'paths') path
        )
     or cpr.completed_lessons>cpr.total_lessons
     or (cpr.current_path_id is not null and cpr.current_lesson_id is not null and not exists(
          select 1 from jsonb_array_elements(cpv.manifest->'paths') path
          cross join jsonb_array_elements(path->'nodes') node
          where path->>'id'=cpr.current_path_id and node->>'id'=cpr.current_lesson_id
        ))
     or cpr.completion_percent<0 or cpr.completion_percent>100
     or (cpr.auto_score is not null and (cpr.auto_score<0 or cpr.auto_score>100))
     or (cpr.final_score is not null and (cpr.final_score<0 or cpr.final_score>100))
     or (cpr.grade_status in ('auto_graded','graded') and cpr.final_score is null);
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: course progress contains % inconsistent row(s)',v_count;
  end if;

  select count(*) into v_count
  from public.grade_share_links gsl
  where cardinality(gsl.scope_course_ids)=0
     or cardinality(gsl.scope_course_ids)<>(select count(distinct scoped_course) from unnest(gsl.scope_course_ids) scoped_course)
     or exists(select 1 from unnest(gsl.scope_course_ids) scoped_course where scoped_course is null)
     or exists(
          select 1 from unnest(gsl.scope_course_ids) scoped_course
          where not exists(
            select 1 from public.course_memberships cm
            where cm.course_id=scoped_course and cm.user_id=gsl.student_id and cm.role='learner'
              and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
          )
        )
     or exists(
          select 1 from unnest(gsl.scope_course_ids) scoped_course
          join public.courses c on c.id=scoped_course
          where c.institution_id is not null and (
            gsl.viewer_id is null
            or not (
              private.has_active_institution_affiliation(gsl.viewer_id,c.institution_id,null)
              or exists(
                select 1 from public.institution_memberships im
                where im.institution_id=c.institution_id and im.user_id=gsl.viewer_id and im.status='active'
              )
            )
          )
        );
  if v_count>0 then
    raise exception 'Student-data safety preflight failed: grade shares contain % inconsistent row(s)',v_count;
  end if;
end;
$$;

drop trigger if exists courses_tenant_scope_guard on public.courses;
create trigger courses_tenant_scope_guard before insert or update on public.courses
for each row execute function private.enforce_course_tenant_scope();
drop trigger if exists course_memberships_scope_guard on public.course_memberships;
create trigger course_memberships_scope_guard before insert or update on public.course_memberships
for each row execute function private.enforce_course_membership_scope();
drop trigger if exists grade_items_scope_guard on public.grade_items;
create trigger grade_items_scope_guard before insert or update on public.grade_items
for each row execute function private.enforce_grade_item_scope();
drop trigger if exists student_grades_scope_guard on public.student_grades;
create trigger student_grades_scope_guard before insert or update on public.student_grades
for each row execute function private.enforce_student_grade_scope();
drop trigger if exists student_roster_entries_scope_guard on public.student_roster_entries;
create trigger student_roster_entries_scope_guard before insert or update on public.student_roster_entries
for each row execute function private.enforce_roster_entry_scope();
drop trigger if exists student_enrollment_requests_scope_guard on public.student_enrollment_requests;
create trigger student_enrollment_requests_scope_guard before insert or update on public.student_enrollment_requests
for each row execute function private.enforce_enrollment_request_scope();
drop trigger if exists assignment_drafts_scope_guard on public.assignment_drafts;
create trigger assignment_drafts_scope_guard before insert or update on public.assignment_drafts
for each row execute function private.enforce_assignment_draft_scope();
drop trigger if exists learning_resources_scope_guard on public.learning_resources;
create trigger learning_resources_scope_guard before insert or update on public.learning_resources
for each row execute function private.enforce_learning_resource_scope();
drop trigger if exists student_groups_scope_guard on public.student_groups;
create trigger student_groups_scope_guard before insert or update on public.student_groups
for each row execute function private.enforce_student_group_scope();
drop trigger if exists student_posts_scope_guard on public.student_posts;
create trigger student_posts_scope_guard before insert or update on public.student_posts
for each row execute function private.enforce_student_post_scope();
drop trigger if exists course_lesson_progress_scope_guard on public.course_lesson_progress;
create trigger course_lesson_progress_scope_guard before insert or update on public.course_lesson_progress
for each row execute function private.enforce_course_lesson_progress_scope();
drop trigger if exists course_progress_scope_guard on public.course_progress;
create trigger course_progress_scope_guard before insert or update on public.course_progress
for each row execute function private.enforce_course_progress_scope();
drop trigger if exists grade_share_links_scope_guard on public.grade_share_links;
create trigger grade_share_links_scope_guard before insert or update on public.grade_share_links
for each row execute function private.enforce_grade_share_scope();

revoke all on function private.enforce_course_tenant_scope() from public;
revoke all on function private.enforce_course_membership_scope() from public;
revoke all on function private.enforce_grade_item_scope() from public;
revoke all on function private.enforce_student_grade_scope() from public;
revoke all on function private.enforce_roster_entry_scope() from public;
revoke all on function private.enforce_enrollment_request_scope() from public;
revoke all on function private.enforce_assignment_draft_scope() from public;
revoke all on function private.enforce_learning_resource_scope() from public;
revoke all on function private.enforce_student_group_scope() from public;
revoke all on function private.enforce_student_post_scope() from public;
revoke all on function private.enforce_course_lesson_progress_scope() from public;
revoke all on function private.enforce_course_progress_scope() from public;
revoke all on function private.grade_share_viewer_has_scope(uuid,uuid) from public;
revoke all on function private.enforce_grade_share_scope() from public;
grant execute on function private.grade_share_viewer_has_scope(uuid,uuid) to authenticated;

drop policy if exists course_memberships_insert on public.course_memberships;
create policy course_memberships_insert
on public.course_memberships for insert to authenticated
with check (private.can_manage_course(course_id) and private.can_join_course(user_id,course_id));
drop policy if exists course_memberships_update on public.course_memberships;
create policy course_memberships_update
on public.course_memberships for update to authenticated
using (private.can_manage_course(course_id))
with check (private.can_manage_course(course_id) and private.can_join_course(user_id,course_id));

drop policy if exists enrollment_insert on public.student_enrollment_requests;
create policy enrollment_insert
on public.student_enrollment_requests for insert to authenticated
with check (
  status='pending' and approved_by is null and decided_at is null
  and private.can_join_course(student_id,course_id)
  and (student_id=(select auth.uid()) or private.can_manage_course(course_id))
);
drop policy if exists enrollment_manage_update on public.student_enrollment_requests;
create policy enrollment_manage_update
on public.student_enrollment_requests for update to authenticated
using (private.can_manage_course(course_id))
with check (
  private.can_manage_course(course_id)
  and status='rejected' and approved_by is null and decided_at is not null
);

drop policy if exists student_grades_select on public.student_grades;
create policy student_grades_select
on public.student_grades for select to authenticated
using (
  student_id=(select auth.uid())
  or private.can_manage_course(course_id)
  or exists(
    select 1 from public.grade_share_links gsl
    where gsl.student_id=student_grades.student_id
      and student_grades.course_id=any(gsl.scope_course_ids)
      and private.grade_share_viewer_has_scope(gsl.id,(select auth.uid()))
  )
);

drop policy if exists grade_share_links_select on public.grade_share_links;
create policy grade_share_links_select
on public.grade_share_links for select to authenticated
using (
  student_id=(select auth.uid())
  or private.grade_share_viewer_has_scope(id,(select auth.uid()))
);

-- Progress and score fields are server-calculated. Browsers may read their own
-- rows, but all writes must use the manifest-validating RPC below (or the
-- professor-only grading RPC).
revoke insert,update,delete on public.course_lesson_progress from authenticated;
revoke insert,update,delete on public.course_progress from authenticated;
revoke insert,update,delete on public.student_grades from authenticated;

create or replace function public.save_course_lesson_progress(
  p_publication_id uuid,
  p_path_id text,
  p_lesson_id text,
  p_section_index integer,
  p_phase text,
  p_interaction_state jsonb default '{}'::jsonb,
  p_complete boolean default false
)
returns public.course_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pub public.course_publications%rowtype;
  v_manifest jsonb;
  v_node jsonb;
  v_check jsonb;
  v_total_questions integer:=0;
  v_correct integer:=0;
  v_lesson_score numeric(5,2):=null;
  v_total_lessons integer:=0;
  v_completed integer:=0;
  v_auto_score numeric(5,2):=null;
  v_course_status text:='in_progress';
  v_grade_status text:='in_progress';
  v_progress public.course_progress%rowtype;
  v_max_points numeric:=100;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_path_id),'') is null or nullif(trim(p_lesson_id),'') is null
     or char_length(p_path_id)>200 or char_length(p_lesson_id)>200 then
    raise exception 'A valid path and lesson are required';
  end if;
  if jsonb_typeof(coalesce(p_interaction_state,'{}'::jsonb))<>'object'
     or octet_length(coalesce(p_interaction_state,'{}'::jsonb)::text)>262144 then
    raise exception 'Interaction state must be a small JSON object';
  end if;
  select * into v_pub from public.course_publications
  where id=p_publication_id and status='published' for share;
  if not found or not private.can_access_course(v_pub.course_id) then raise exception 'Course access denied'; end if;
  select cpv.manifest into v_manifest from public.course_publication_versions cpv
  where cpv.publication_id=v_pub.id and cpv.version_number=v_pub.current_version;
  select node into v_node
  from jsonb_array_elements(v_manifest->'paths') path
  cross join jsonb_array_elements(path->'nodes') node
  where path->>'id'=p_path_id and node->>'id'=p_lesson_id
  limit 1;
  if v_node is null then raise exception 'Lesson not found in the current publication version'; end if;

  if p_complete then
    for v_check in select value from jsonb_array_elements(coalesce(v_node->'knowledgeChecks','[]'::jsonb)) loop
      v_total_questions:=v_total_questions+1;
      if coalesce(p_interaction_state->'knowledgeAnswers'->>(v_check->>'id'),'')=coalesce(v_check->>'correctAnswer','') then
        v_correct:=v_correct+1;
      end if;
    end loop;
    for v_check in select value from jsonb_array_elements(coalesce(v_node->'endQuiz','[]'::jsonb)) loop
      v_total_questions:=v_total_questions+1;
      if coalesce(p_interaction_state->'quizAnswers'->>(v_check->>'id'),'')=coalesce(v_check->>'correctAnswer','') then
        v_correct:=v_correct+1;
      end if;
    end loop;
    v_lesson_score:=case when v_total_questions=0 then 100
      else round((v_correct::numeric/v_total_questions::numeric)*100,2) end;
  end if;

  insert into public.course_lesson_progress(
    publication_id,course_id,user_id,version_number,path_id,lesson_id,section_index,
    phase,status,interaction_state,auto_score,completed_at,updated_at
  ) values (
    v_pub.id,v_pub.course_id,(select auth.uid()),v_pub.current_version,p_path_id,p_lesson_id,
    greatest(coalesce(p_section_index,0),0),
    case when p_phase in ('lesson','scenario','knowledge','quiz','assignment','complete') then p_phase else 'lesson' end,
    case when p_complete then 'completed' else 'in_progress' end,
    coalesce(p_interaction_state,'{}'::jsonb),v_lesson_score,
    case when p_complete then now() else null end,now()
  ) on conflict(publication_id,user_id,path_id,lesson_id) do update set
    version_number=excluded.version_number,
    section_index=excluded.section_index,
    phase=excluded.phase,
    status=case when public.course_lesson_progress.version_number=excluded.version_number
                     and public.course_lesson_progress.status='completed'
                then 'completed' else excluded.status end,
    interaction_state=excluded.interaction_state,
    auto_score=case when public.course_lesson_progress.version_number=excluded.version_number
                         and public.course_lesson_progress.status='completed'
                    then public.course_lesson_progress.auto_score else excluded.auto_score end,
    completed_at=case when public.course_lesson_progress.version_number=excluded.version_number
                           and public.course_lesson_progress.status='completed'
                      then public.course_lesson_progress.completed_at else excluded.completed_at end,
    updated_at=now();

  select coalesce(sum(jsonb_array_length(path->'nodes')),0)::integer into v_total_lessons
  from jsonb_array_elements(v_manifest->'paths') path;
  select count(*)::integer,round(avg(clp.auto_score),2)
  into v_completed,v_auto_score
  from public.course_lesson_progress clp
  where clp.publication_id=v_pub.id and clp.user_id=(select auth.uid())
    and clp.version_number=v_pub.current_version and clp.status='completed'
    and exists (
      select 1 from jsonb_array_elements(v_manifest->'paths') path
      cross join jsonb_array_elements(path->'nodes') node
      where path->>'id'=clp.path_id and node->>'id'=clp.lesson_id
    );
  if v_total_lessons>0 and v_completed=v_total_lessons then
    v_course_status:='completed';
    v_grade_status:=case when v_pub.grading_mode='auto' then 'auto_graded' else 'awaiting_grading' end;
  end if;

  insert into public.course_progress(
    publication_id,course_id,user_id,version_number,current_path_id,current_lesson_id,
    current_section_index,status,completed_lessons,total_lessons,completion_percent,
    auto_score,final_score,grade_status,completed_at,last_opened_at,updated_at
  ) values (
    v_pub.id,v_pub.course_id,(select auth.uid()),v_pub.current_version,p_path_id,p_lesson_id,
    greatest(coalesce(p_section_index,0),0),v_course_status,v_completed,v_total_lessons,
    case when v_total_lessons=0 then 0 else round((v_completed::numeric/v_total_lessons::numeric)*100,2) end,
    v_auto_score,case when v_grade_status='auto_graded' then v_auto_score else null end,v_grade_status,
    case when v_course_status='completed' then now() else null end,now(),now()
  ) on conflict(publication_id,user_id) do update set
    version_number=excluded.version_number,current_path_id=excluded.current_path_id,
    current_lesson_id=excluded.current_lesson_id,current_section_index=excluded.current_section_index,
    status=excluded.status,completed_lessons=excluded.completed_lessons,total_lessons=excluded.total_lessons,
    completion_percent=excluded.completion_percent,auto_score=excluded.auto_score,
    final_score=case when public.course_progress.version_number=excluded.version_number
                          and public.course_progress.grade_status='graded'
                     then public.course_progress.final_score else excluded.final_score end,
    grade_status=case when public.course_progress.version_number=excluded.version_number
                           and public.course_progress.grade_status='graded'
                      then 'graded' else excluded.grade_status end,
    completed_at=case when public.course_progress.version_number=excluded.version_number
                           then coalesce(public.course_progress.completed_at,excluded.completed_at)
                      else excluded.completed_at end,
    last_opened_at=now(),updated_at=now()
  returning * into v_progress;

  if v_course_status='completed' and v_pub.grade_item_id is not null and v_progress.grade_status<>'graded' then
    select gi.max_points into v_max_points from public.grade_items gi where gi.id=v_pub.grade_item_id;
    insert into public.student_grades(course_id,grade_item_id,student_id,score,status,published_at,finalized_at)
    values(
      v_pub.course_id,v_pub.grade_item_id,(select auth.uid()),
      case when v_pub.grading_mode='auto' then round(v_auto_score*v_max_points/100,2) else null end,
      case when v_pub.grading_mode='auto' then 'finalized' else 'pending' end,
      case when v_pub.grading_mode='auto' then now() else null end,
      case when v_pub.grading_mode='auto' then now() else null end
    ) on conflict(grade_item_id,student_id) do update set
      score=excluded.score,status=excluded.status,published_at=excluded.published_at,
      finalized_at=excluded.finalized_at,updated_at=now();
  end if;
  return v_progress;
end;
$$;

revoke all on function public.get_course_progress_overview(uuid) from public,anon;
revoke all on function public.grade_course_progress(uuid,uuid,numeric,text) from public,anon;
revoke all on function public.publish_course_package(uuid,jsonb,text,text,text,text) from public,anon;
revoke all on function public.save_course_lesson_progress(uuid,text,text,integer,text,jsonb,boolean) from public,anon;
revoke all on function public.save_course_package_draft(uuid,jsonb,text,text,text) from public,anon;
revoke all on function public.set_course_publication_state(uuid,text) from public,anon;
grant execute on function public.get_course_progress_overview(uuid) to authenticated;
grant execute on function public.grade_course_progress(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.publish_course_package(uuid,jsonb,text,text,text,text) to authenticated;
grant execute on function public.save_course_lesson_progress(uuid,text,text,integer,text,jsonb,boolean) to authenticated;
grant execute on function public.save_course_package_draft(uuid,jsonb,text,text,text) to authenticated;
grant execute on function public.set_course_publication_state(uuid,text) to authenticated;

alter table public.blackboard_grade_exports
  add column if not exists output_file_hash text
    check (output_file_hash is null or output_file_hash~'^[a-f0-9]{64}$'),
  add column if not exists output_byte_length bigint
    check (output_byte_length is null or output_byte_length between 1 and 52428800);

revoke all on function public.confirm_blackboard_grade_export(uuid,text,text,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb)
from public,anon,authenticated;
drop function public.confirm_blackboard_grade_export(uuid,text,text,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb);

create or replace function public.confirm_blackboard_grade_export(
  p_course_id uuid,
  p_source_filename text,
  p_source_file_hash text,
  p_output_file_hash text,
  p_output_byte_length integer,
  p_export_filename text,
  p_format_detected text,
  p_total_rows integer,
  p_matched_students integer,
  p_unmatched_students integer,
  p_mapped_columns integer,
  p_changed_grade_cells integer,
  p_warning_count integer,
  p_mapping_snapshot jsonb,
  p_grade_snapshot jsonb
)
returns public.blackboard_grade_exports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses%rowtype;
  v_entry jsonb;
  v_source_kind text;
  v_row_key text;
  v_column_key text;
  v_student_id uuid;
  v_grade_item_id uuid;
  v_source_score numeric;
  v_source_updated_at timestamptz;
  v_exported_score numeric;
  v_actual_score numeric;
  v_actual_updated_at timestamptz;
  v_status text;
  v_source_maximum numeric;
  v_expected_export numeric;
  v_column public.blackboard_grade_column_mappings%rowtype;
  v_export public.blackboard_grade_exports%rowtype;
  v_verified_mapping_snapshot jsonb;
  v_verified_grade_snapshot jsonb:='[]'::jsonb;
begin
  if (select auth.uid()) is null or not private.can_manage_course(p_course_id) then raise exception 'Course access denied'; end if;
  if p_source_file_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source file hash'; end if;
  if p_output_file_hash !~ '^[a-f0-9]{64}$' or p_output_byte_length<1 or p_output_byte_length>52428800 then
    raise exception 'Invalid generated output evidence';
  end if;
  if p_source_filename is null or p_export_filename is null
     or p_source_filename~'[/\\]' or p_export_filename~'[/\\]'
     or char_length(p_source_filename)>255 or char_length(p_export_filename)>255 then
    raise exception 'Invalid export filename';
  end if;
  if jsonb_typeof(p_grade_snapshot)<>'array' or jsonb_array_length(p_grade_snapshot)<>p_changed_grade_cells then
    raise exception 'Grade snapshot does not match changed grade count';
  end if;
  if jsonb_typeof(p_mapping_snapshot)<>'object'
     or jsonb_typeof(p_mapping_snapshot->'students')<>'array'
     or jsonb_typeof(p_mapping_snapshot->'columns')<>'array' then
    raise exception 'Invalid mapping snapshot';
  end if;
  if p_total_rows<1 or p_total_rows>50000 or p_matched_students<1 or p_unmatched_students<0
     or p_matched_students+p_unmatched_students>p_total_rows
     or p_mapped_columns<1 or p_mapped_columns>1000
     or p_changed_grade_cells<1 or p_changed_grade_cells>5000000
     or p_warning_count<0 or p_warning_count>100000 then
    raise exception 'Invalid export summary';
  end if;
  if jsonb_array_length(p_mapping_snapshot->'students')<>p_matched_students then
    raise exception 'Student mapping count does not match export summary';
  end if;
  if (select count(*) from jsonb_array_elements(p_mapping_snapshot->'columns') c where c->>'mapping_type'<>'ignore')<>p_mapped_columns then
    raise exception 'Column mapping count does not match export summary';
  end if;
  if p_changed_grade_cells>p_matched_students*p_mapped_columns then raise exception 'Changed grade count exceeds mapped output cells'; end if;
  select * into v_course from public.courses where id=p_course_id;
  if not found then raise exception 'Course not found'; end if;

  if exists (
    select 1 from (
      select s->>'row_key' key,count(*) n from jsonb_array_elements(p_mapping_snapshot->'students') s group by s->>'row_key'
      union all
      select s->>'learner_id',count(*) from jsonb_array_elements(p_mapping_snapshot->'students') s group by s->>'learner_id'
      union all
      select c->>'blackboard_column_key',count(*) from jsonb_array_elements(p_mapping_snapshot->'columns') c group by c->>'blackboard_column_key'
    ) duplicates where key is null or n<>1
  ) then raise exception 'Mapping snapshot contains missing or duplicate identifiers'; end if;

  for v_entry in select value from jsonb_array_elements(p_mapping_snapshot->'students') loop
    v_student_id:=(v_entry->>'learner_id')::uuid;
    if not exists (
      select 1 from public.blackboard_identity_mappings bim
      where bim.course_id=p_course_id and bim.blackboard_row_key=v_entry->>'row_key'
        and bim.ednotebook_user_id=v_student_id and bim.match_method=v_entry->>'match_method'
    ) or not exists (
      select 1 from public.course_memberships cm
      where cm.course_id=p_course_id and cm.user_id=v_student_id and cm.role='learner'
        and private.course_membership_is_current(cm.course_id,cm.user_id,cm.role)
    ) then raise exception 'Student mapping snapshot is stale or outside the course'; end if;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_mapping_snapshot->'columns') loop
    select * into v_column from public.blackboard_grade_column_mappings bgcm
    where bgcm.course_id=p_course_id and bgcm.blackboard_column_key=v_entry->>'blackboard_column_key';
    if not found
       or v_column.blackboard_column_name is distinct from v_entry->>'blackboard_column_name'
       or v_column.blackboard_points_possible is distinct from nullif(v_entry->>'blackboard_points_possible','')::numeric
       or v_column.external_line_item_id is distinct from nullif(v_entry->>'external_line_item_id','')
       or v_column.ednotebook_grade_item_id is distinct from nullif(v_entry->>'ednotebook_grade_item_id','')::uuid
       or v_column.mapping_type is distinct from v_entry->>'mapping_type'
       or v_column.scaling_mode is distinct from v_entry->>'scaling_mode'
       or (v_column.mapping_type='grade_item' and not exists(
         select 1 from public.grade_items gi where gi.id=v_column.ednotebook_grade_item_id and gi.course_id=p_course_id
       )) then raise exception 'Column mapping snapshot is stale or outside the course'; end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_mapping_snapshot->'columns') c
    where c->>'mapping_type'<>'ignore'
    group by c->>'mapping_type',coalesce(c->>'ednotebook_grade_item_id','')
    having count(*)<>1
  ) then raise exception 'Mapping snapshot contains duplicate grade sources'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_grade_snapshot) g
    group by g->>'blackboard_row_key',g->>'blackboard_column_key'
    having count(*)<>1
  ) then raise exception 'Grade snapshot contains duplicate output sources'; end if;

  for v_entry in select value from jsonb_array_elements(p_grade_snapshot) loop
    v_row_key:=nullif(v_entry->>'blackboard_row_key','');
    v_column_key:=nullif(v_entry->>'blackboard_column_key','');
    v_source_kind:=v_entry->>'source_kind';
    v_student_id:=(v_entry->>'student_id')::uuid;
    v_grade_item_id:=nullif(v_entry->>'grade_item_id','')::uuid;
    v_source_score:=nullif(v_entry->>'source_score','')::numeric;
    v_source_updated_at:=nullif(v_entry->>'source_updated_at','')::timestamptz;
    v_exported_score:=nullif(v_entry->>'exported_score','')::numeric;
    if v_source_score is null or v_source_updated_at is null or v_exported_score is null
       or v_row_key is null or v_column_key is null
       or v_source_score::text in ('NaN','Infinity','-Infinity')
       or v_exported_score::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Grade snapshot contains a missing or non-finite value';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(p_mapping_snapshot->'students') s
      join public.blackboard_identity_mappings bim
        on bim.course_id=p_course_id and bim.blackboard_row_key=s->>'row_key'
      where s->>'row_key'=v_row_key and (s->>'learner_id')::uuid=v_student_id
        and bim.ednotebook_user_id=v_student_id
    ) then raise exception 'Grade snapshot Blackboard row is not bound to the verified learner'; end if;

    if v_source_kind='grade_item' then
      select sg.score,sg.updated_at,sg.status,gi.max_points
      into v_actual_score,v_actual_updated_at,v_status,v_source_maximum
      from public.student_grades sg join public.grade_items gi on gi.id=sg.grade_item_id
      where sg.course_id=p_course_id and sg.student_id=v_student_id and sg.grade_item_id=v_grade_item_id;
      if not found or v_status<>'finalized' or v_actual_score is null then raise exception 'Export includes a grade that is not finalized'; end if;
    elsif v_source_kind in ('course_completion','final_course_grade') then
      select case when v_source_kind='course_completion' then cp.completion_percent else coalesce(cp.final_score,cp.auto_score) end,
        cp.updated_at,case when v_source_kind='course_completion' then cp.status else cp.grade_status end,100
      into v_actual_score,v_actual_updated_at,v_status,v_source_maximum
      from public.course_progress cp
      where cp.course_id=p_course_id and cp.user_id=v_student_id
      order by cp.updated_at desc limit 1;
      if not found or v_actual_score is null
         or (v_source_kind='course_completion' and v_status<>'completed')
         or (v_source_kind='final_course_grade' and v_status not in ('graded','auto_graded')) then
        raise exception 'Export includes course progress that is not finalized';
      end if;
    else raise exception 'Unsupported grade source'; end if;

    if v_actual_score is distinct from v_source_score or v_actual_updated_at is distinct from v_source_updated_at then
      raise exception 'Grades changed after preview; generate a new preview';
    end if;
    select bgcm.* into v_column
    from jsonb_array_elements(p_mapping_snapshot->'columns') c
    join public.blackboard_grade_column_mappings bgcm
      on bgcm.course_id=p_course_id and bgcm.blackboard_column_key=c->>'blackboard_column_key'
    where c->>'blackboard_column_key'=v_column_key and bgcm.mapping_type=v_source_kind
      and (v_source_kind<>'grade_item' or bgcm.ednotebook_grade_item_id=v_grade_item_id)
    limit 1;
    if not found then raise exception 'Grade snapshot Blackboard column is not bound to the verified source'; end if;
    if v_column.scaling_mode in ('raw','none') then v_expected_export:=round(v_actual_score,2);
    elsif v_column.scaling_mode='percentage' then v_expected_export:=round(v_actual_score/v_source_maximum*100,2);
    elsif v_column.scaling_mode='proportional' and v_column.blackboard_points_possible>0 then
      v_expected_export:=round(v_actual_score/v_source_maximum*v_column.blackboard_points_possible,2);
    else raise exception 'Verified Blackboard scaling rule is invalid'; end if;
    if v_exported_score is distinct from v_expected_export or v_exported_score<0
       or (v_column.blackboard_points_possible is not null and v_exported_score>v_column.blackboard_points_possible) then
      raise exception 'Exported grade does not match the verified source, scale, or target range';
    end if;
    v_verified_grade_snapshot:=v_verified_grade_snapshot||jsonb_build_array(jsonb_build_object(
      'blackboard_row_key',v_row_key,'blackboard_column_key',v_column.blackboard_column_key,
      'student_id',v_student_id,'source_kind',v_source_kind,'grade_item_id',v_grade_item_id,
      'source_score',v_actual_score,'source_updated_at',v_actual_updated_at,
      'blackboard_column_key',v_column.blackboard_column_key,'exported_score',v_expected_export
    ));
  end loop;

  select jsonb_build_object(
    'students',coalesce((select jsonb_agg(jsonb_build_object(
      'row_key',bim.blackboard_row_key,'learner_id',bim.ednotebook_user_id,'match_method',bim.match_method,
      'confirmed_at',bim.confirmed_at,'updated_at',bim.updated_at
    ) order by bim.blackboard_row_key)
      from jsonb_array_elements(p_mapping_snapshot->'students') s
      join public.blackboard_identity_mappings bim on bim.course_id=p_course_id and bim.blackboard_row_key=s->>'row_key'),'[]'::jsonb),
    'columns',coalesce((select jsonb_agg(jsonb_build_object(
      'blackboard_column_key',bgcm.blackboard_column_key,'blackboard_column_name',bgcm.blackboard_column_name,
      'blackboard_points_possible',bgcm.blackboard_points_possible,'external_line_item_id',bgcm.external_line_item_id,
      'ednotebook_grade_item_id',bgcm.ednotebook_grade_item_id,'mapping_type',bgcm.mapping_type,
      'scaling_mode',bgcm.scaling_mode,'canonical_line_item',bgcm.canonical_line_item,
      'confirmed_at',bgcm.confirmed_at,'updated_at',bgcm.updated_at
    ) order by bgcm.blackboard_column_key)
      from jsonb_array_elements(p_mapping_snapshot->'columns') c
      join public.blackboard_grade_column_mappings bgcm on bgcm.course_id=p_course_id and bgcm.blackboard_column_key=c->>'blackboard_column_key'),'[]'::jsonb)
  ) into v_verified_mapping_snapshot;

  insert into public.blackboard_grade_exports(
    institution_id,course_id,academic_session_label,created_by,source_filename,source_file_hash,
    output_file_hash,output_byte_length,export_filename,blackboard_format_detected,total_rows,matched_students,unmatched_students,
    mapped_columns,changed_grade_cells,warning_count,blocking_issue_count,status,confirmed_at,
    generated_at,export_summary,mapping_snapshot,grade_snapshot_hash
  ) values (
    v_course.institution_id,p_course_id,left(v_course.teaching_window,180),(select auth.uid()),
    left(p_source_filename,255),p_source_file_hash,p_output_file_hash,p_output_byte_length,
    left(p_export_filename,255),left(coalesce(p_format_detected,'Blackboard CSV'),200),
    p_total_rows,p_matched_students,p_unmatched_students,p_mapped_columns,p_changed_grade_cells,p_warning_count,
    0,'generated',now(),now(),jsonb_build_object(
      'total_rows',p_total_rows,'matched_students',p_matched_students,'unmatched_students',p_unmatched_students,
      'mapped_columns',p_mapped_columns,'changed_grade_cells',p_changed_grade_cells,'warning_count',p_warning_count,
      'grade_cells_verification','server_reconciled','output_hash_source','client_generated_exact_bytes',
      'output_file_hash',p_output_file_hash,'output_byte_length',p_output_byte_length
    ),v_verified_mapping_snapshot,encode(extensions.digest(v_verified_grade_snapshot::text,'sha256'),'hex')
  ) returning * into v_export;
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values
    ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.export_confirmed','blackboard_grade_export',v_export.id::text,
      jsonb_build_object('changed_grade_cells',p_changed_grade_cells,'warning_count',p_warning_count,'server_reconciled',true),''),
    ((select auth.uid()),v_course.institution_id,p_course_id,'blackboard.csv_generated','blackboard_grade_export',v_export.id::text,
      jsonb_build_object('source_file_hash',p_source_file_hash,'output_file_hash',p_output_file_hash,
        'output_byte_length',p_output_byte_length,'changed_grade_cells',p_changed_grade_cells), '');
  return v_export;
end;
$$;
revoke all on function public.confirm_blackboard_grade_export(uuid,text,text,text,integer,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb) from public,anon;
grant execute on function public.confirm_blackboard_grade_export(uuid,text,text,text,integer,text,text,integer,integer,integer,integer,integer,integer,jsonb,jsonb) to authenticated;

create or replace function public.approve_student_enrollment(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_request public.student_enrollment_requests%rowtype; v_course public.courses%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.student_enrollment_requests where id=p_request_id for update;
  if not found or v_request.status<>'pending' or not private.can_manage_course(v_request.course_id) then
    raise exception 'Pending enrollment request not found or not manageable';
  end if;
  select * into v_course from public.courses where id=v_request.course_id;
  if v_course.institution_id is not null and not private.has_active_institution_affiliation(v_request.student_id,v_course.institution_id,'student') then
    raise exception 'The learner does not have an active student affiliation for this institution';
  end if;
  update public.student_enrollment_requests set status='approved',approved_by=(select auth.uid()),decided_at=now() where id=p_request_id;
  if v_request.roster_entry_id is not null then
    update public.student_roster_entries set matched_user_id=v_request.student_id,match_status='approved',updated_at=now()
    where id=v_request.roster_entry_id;
  end if;
  insert into public.course_memberships(course_id,user_id,role) values(v_request.course_id,v_request.student_id,'learner')
  on conflict(course_id,user_id) do update set role='learner';
  insert into public.audit_events(actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_course.institution_id,v_course.id,'course.enrollment_approved','profile',v_request.student_id::text,
    jsonb_build_object('institution_checked',true,'request_id',p_request_id), '');
end;
$$;

revoke all on function public.approve_student_enrollment(uuid) from public, anon;
grant execute on function public.approve_student_enrollment(uuid) to authenticated;

create or replace function public.record_integration_test(
  p_connection_id uuid,
  p_capability_key text,
  p_status text,
  p_safe_summary text,
  p_evidence jsonb default '{}'::jsonb
)
returns public.integration_test_runs
language plpgsql
security definer
set search_path = ''
as $$
declare v_connection public.integration_connections%rowtype; v_run public.integration_test_runs;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_connection from public.integration_connections where id=p_connection_id for update;
  if not found then raise exception 'Connection not found'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or (
      v_connection.institution_id is null
      and private.has_platform_capability('test_integrations',(select auth.uid()))
    )
    or (
      v_connection.institution_id is not null
      and v_connection.institution_controllable
      and private.has_institution_capability(v_connection.institution_id,'test_integrations',(select auth.uid()))
    )
  ) then raise exception 'Connection testing access required'; end if;
  if p_status not in ('passed','failed','warning') then raise exception 'Invalid test result'; end if;
  if nullif(trim(p_safe_summary),'') is null then raise exception 'A safe test summary is required'; end if;
  if jsonb_typeof(coalesce(p_evidence,'{}'::jsonb))<>'object' or octet_length(coalesce(p_evidence,'{}'::jsonb)::text)>32768 then
    raise exception 'Test evidence must be a small JSON object';
  end if;
  if nullif(p_capability_key,'') is not null and not exists(
    select 1 from public.integration_connection_capabilities icc
    where icc.connection_id=p_connection_id and icc.capability_key=p_capability_key
  ) then raise exception 'Connection capability not found'; end if;
  insert into public.integration_test_runs(connection_id,capability_key,status,safe_summary,evidence,tested_by)
  values(p_connection_id,nullif(p_capability_key,''),p_status,left(trim(p_safe_summary),1000),coalesce(p_evidence,'{}'::jsonb),(select auth.uid()))
  returning * into v_run;
  update public.integration_connections set last_tested_at=now(),last_test_status=p_status,
    health_status=case when p_status='passed' then 'healthy' when p_status='warning' then 'warning' else 'failed' end,
    activation_status=case when p_status='passed' and activation_status in ('setup','testing') then 'ready' else activation_status end,
    updated_at=now() where id=p_connection_id;
  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),v_connection.institution_id,'integration.test_recorded','integration_connection',p_connection_id::text,
    jsonb_build_object('capability_key',p_capability_key,'status',p_status), '');
  return v_run;
end;
$$;

revoke all on function public.record_integration_test(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.record_integration_test(uuid,text,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Idempotent deletion requests and atomic worker claims
-- ---------------------------------------------------------------------------

alter table public.file_deletion_requests
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,
  add column if not exists claim_expires_at timestamptz,
  add column if not exists failure_count integer not null default 0 check (failure_count>=0),
  add column if not exists next_attempt_at timestamptz,
  add column if not exists completion_outcome text
    check (completion_outcome is null or completion_outcome in ('normal','late_governance_conflict','partial_deletion'));

alter table public.secure_file_objects
  add column if not exists expiration_claim_token uuid,
  add column if not exists expiration_claimed_at timestamptz,
  add column if not exists expiration_claimed_by text,
  add column if not exists expiration_claim_expires_at timestamptz,
  add column if not exists expiration_failure_count integer not null default 0 check (expiration_failure_count>=0),
  add column if not exists expiration_last_error text,
  add column if not exists expiration_next_attempt_at timestamptz,
  add column if not exists expiration_completion_outcome text
    check (expiration_completion_outcome is null or expiration_completion_outcome in ('normal','late_governance_conflict'));

do $$
declare v_duplicate_count integer;
begin
  select count(*) into v_duplicate_count from (
    select secure_file_id from public.file_deletion_requests
    where status in ('pending','eligible','deferred_retention','blocked_legal_hold','processing','failed')
    group by secure_file_id having count(*)>1
  ) duplicates;
  if v_duplicate_count>0 then
    raise exception 'Student-data safety preflight failed: % files have duplicate active deletion requests',v_duplicate_count;
  end if;
end;
$$;

create unique index if not exists file_deletion_requests_one_active_per_file_idx
on public.file_deletion_requests(secure_file_id)
where status in ('pending','eligible','deferred_retention','blocked_legal_hold','processing','failed');

create index if not exists file_deletion_requests_claimable_idx
on public.file_deletion_requests(status,eligible_at,next_attempt_at,claim_expires_at,created_at)
where status in ('eligible','deferred_retention','blocked_legal_hold','processing','failed');

create index if not exists secure_file_objects_expiration_claim_idx
on public.secure_file_objects(upload_expires_at,expiration_next_attempt_at,expiration_claim_expires_at)
where upload_status in ('reserved','uploading');

create or replace function public.request_secure_file_deletion(
  p_secure_file_id uuid,
  p_reason text default ''
)
returns table(request_id uuid,status text,eligible_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.file_deletion_requests%rowtype;
  v_file public.secure_file_objects%rowtype;
  v_status text;
  v_eligible_at timestamptz;
  v_created boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_secure_file(p_secure_file_id,v_user_id) then raise exception 'File management permission required'; end if;

  -- Create-or-find the one active request first. Every deletion mutation then
  -- locks request -> file, avoiding the inverse lock order that can deadlock a
  -- worker renewal against a repeated browser request.
  insert into public.file_deletion_requests(secure_file_id,requested_by,reason,status)
  values(p_secure_file_id,v_user_id,left(coalesce(p_reason,''),2000),'pending')
  on conflict (secure_file_id) where status in ('pending','eligible','deferred_retention','blocked_legal_hold','processing','failed')
  do nothing
  returning true into v_created;
  v_created:=coalesce(v_created,false);
  select * into v_request from public.file_deletion_requests
  where secure_file_id=p_secure_file_id
    and status in ('pending','eligible','deferred_retention','blocked_legal_hold','processing','failed')
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Active deletion request could not be created'; end if;
  if found and v_request.status='processing' then
    return query select v_request.id,v_request.status,v_request.eligible_at;
    return;
  end if;

  select * into v_file from public.secure_file_objects where id=p_secure_file_id for update;
  if not found or v_file.availability_status='deleted' then raise exception 'Managed file is not available for deletion'; end if;

  if private.file_is_on_legal_hold(p_secure_file_id) then
    v_status:='blocked_legal_hold'; v_eligible_at:=null;
    if v_file.availability_status='pending_delete' then
      update public.secure_file_objects set availability_status='released',delete_requested_at=null,updated_at=now() where id=p_secure_file_id;
    end if;
  elsif v_file.retention_until is not null and v_file.retention_until>now() then
    v_status:='deferred_retention'; v_eligible_at:=v_file.retention_until;
    if v_file.availability_status='pending_delete' then
      update public.secure_file_objects set availability_status='released',delete_requested_at=null,updated_at=now() where id=p_secure_file_id;
    end if;
  else
    v_status:='eligible'; v_eligible_at:=now();
    update public.secure_file_objects set availability_status='pending_delete',delete_requested_at=now(),updated_at=now()
    where id=p_secure_file_id and availability_status<>'deleted';
  end if;

  update public.file_deletion_requests set requested_by=v_user_id,reason=left(coalesce(p_reason,''),2000),
    status=v_status,eligible_at=v_eligible_at,processed_at=null,next_attempt_at=null,
    completion_outcome=case when v_request.completion_outcome='partial_deletion' then 'partial_deletion' else null end,
    claim_token=null,claimed_at=null,claimed_by=null,claim_expires_at=null,updated_at=now()
  where id=v_request.id returning * into v_request;

  insert into public.audit_events(actor_id,institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash)
  values(v_user_id,v_file.institution_id,v_file.course_id,v_file.assignment_id,p_secure_file_id,
    case when v_created then 'delete.requested' else 'delete.request_reused' end,
    'secure_file',p_secure_file_id::text,jsonb_build_object('request_id',v_request.id,'status',v_status,'eligible_at',v_eligible_at,'reason',left(coalesce(p_reason,''),2000)), '');
  return query select v_request.id,v_request.status,v_request.eligible_at;
end;
$$;

create or replace function private.claim_file_deletion_candidates(
  p_worker_id text,
  p_limit integer,
  p_claim_ttl interval,
  p_request_id uuid default null
)
returns table(request_id uuid,secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_worker_id),'') is null then raise exception 'Worker identifier is required'; end if;
  if p_claim_ttl is null or p_claim_ttl<interval '1 minute' or p_claim_ttl>interval '1 hour' then raise exception 'Claim lifetime must be from 1 minute to 1 hour'; end if;

  -- A released/expired hold is re-evaluated by the next worker poll. Retention
  -- still wins, and the file returns to pending-delete only when both gates are
  -- clear. This keeps blocked requests recoverable without a manual rewrite.
  with blocked_candidates as (
    select r.id
    from public.file_deletion_requests r
    where r.status='blocked_legal_hold'
      and (p_request_id is null or r.id=p_request_id)
      and not private.file_is_on_legal_hold(r.secure_file_id)
    order by r.created_at
    for update of r skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), reevaluated as (
    update public.file_deletion_requests r set
      status=case when f.retention_until is not null and f.retention_until>now() then 'deferred_retention' else 'eligible' end,
      eligible_at=case when f.retention_until is not null and f.retention_until>now() then f.retention_until else now() end,
      updated_at=now()
    from public.secure_file_objects f,blocked_candidates bc
    where r.id=bc.id and r.secure_file_id=f.id and r.status='blocked_legal_hold'
    returning r.secure_file_id,r.status,r.completion_outcome
  )
  update public.secure_file_objects f set
    availability_status=case
      when rr.completion_outcome='partial_deletion' and rr.status='deferred_retention' then 'blocked'
      when rr.status='eligible' then 'pending_delete'
      else 'released'
    end,
    delete_requested_at=case when rr.status='eligible' then now() else null end,
    updated_at=now()
  from reevaluated rr where f.id=rr.secure_file_id and f.availability_status<>'deleted';

  return query
  with candidates as (
    select r.id
    from public.file_deletion_requests r
    join public.secure_file_objects f on f.id=r.secure_file_id
    where (p_request_id is null or r.id=p_request_id)
      and (
        (r.status in ('eligible','deferred_retention') and (r.eligible_at is null or r.eligible_at<=now()) and f.availability_status<>'deleted')
        or (r.status='failed' and (r.next_attempt_at is null or r.next_attempt_at<=now()) and (
          r.completion_outcome is distinct from 'partial_deletion'
          or (
            not private.file_is_on_legal_hold(f.id)
            and (f.retention_until is null or f.retention_until<=now())
          )
        ))
        or (r.status='processing' and (r.claim_expires_at is null or r.claim_expires_at<=now()))
      )
    order by r.created_at
    for update of r skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.file_deletion_requests r set
      status='processing',claim_token=gen_random_uuid(),claimed_at=now(),claimed_by=left(trim(p_worker_id),200),
      claim_expires_at=now()+p_claim_ttl,updated_at=now()
    from candidates c where r.id=c.id
    returning r.id,r.secure_file_id,r.claim_token,r.claimed_at,r.completion_outcome
  ), prepared_partial_files as (
    update public.secure_file_objects f set availability_status='pending_delete',
      delete_requested_at=coalesce(delete_requested_at,now()),updated_at=now()
    from claimed c
    where f.id=c.secure_file_id and c.completion_outcome='partial_deletion'
      and f.availability_status='blocked'
      and not private.file_is_on_legal_hold(f.id)
      and (f.retention_until is null or f.retention_until<=now())
    returning f.id
  )
  select c.id,c.secure_file_id,c.claim_token,c.claimed_at,
    to_jsonb(f)||jsonb_build_object('deletion_completion_outcome',c.completion_outcome)
  from claimed c join public.secure_file_objects f on f.id=c.secure_file_id
  left join prepared_partial_files ppf on ppf.id=f.id;
end;
$$;

create or replace function public.claim_file_deletion_requests(
  p_worker_id text,
  p_limit integer default 25,
  p_claim_ttl interval default interval '10 minutes'
)
returns table(request_id uuid,secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language sql
security definer
set search_path = ''
as $$ select * from private.claim_file_deletion_candidates(p_worker_id,p_limit,p_claim_ttl,null); $$;

create or replace function public.claim_file_deletion_request(
  p_request_id uuid,
  p_worker_id text,
  p_claim_ttl interval default interval '10 minutes'
)
returns table(request_id uuid,secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language sql
security definer
set search_path = ''
as $$ select * from private.claim_file_deletion_candidates(p_worker_id,1,p_claim_ttl,p_request_id); $$;

create or replace function public.renew_file_deletion_claim(
  p_request_id uuid,
  p_claim_token uuid,
  p_worker_id text
)
returns table(request_id uuid,secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.file_deletion_requests%rowtype;
  v_file public.secure_file_objects%rowtype;
begin
  select * into v_request from public.file_deletion_requests
  where id=p_request_id and status='processing' and claim_token=p_claim_token and claimed_by=left(trim(p_worker_id),200)
    and claim_expires_at>now()
  for update;
  if not found then raise exception 'Matching active deletion claim not found'; end if;
  select * into v_file from public.secure_file_objects where id=v_request.secure_file_id for update;
  if not found then raise exception 'Claimed secure file was not found'; end if;
  if v_file.availability_status<>'deleted' then
    if private.file_is_on_legal_hold(v_file.id) then raise exception 'Claimed secure file is now on an active legal hold'; end if;
    if v_file.retention_until is not null and v_file.retention_until>now() then raise exception 'Claimed secure file retention was extended'; end if;
  end if;
  update public.file_deletion_requests set claimed_at=now(),claim_expires_at=now()+interval '10 minutes',updated_at=now()
  where id=p_request_id and status='processing' and claim_token=p_claim_token and claimed_by=left(trim(p_worker_id),200)
    and claim_expires_at>now()
  returning public.file_deletion_requests.claimed_at into v_request.claimed_at;
  return query select v_request.id,v_request.secure_file_id,p_claim_token,v_request.claimed_at,to_jsonb(v_file);
end;
$$;

create or replace function public.finish_file_deletion_claim(
  p_request_id uuid,
  p_claim_token uuid,
  p_worker_id text,
  p_status text,
  p_eligible_at timestamptz default null,
  p_last_error text default null,
  p_storage_removal_started boolean default false
)
returns public.file_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.file_deletion_requests%rowtype;
  v_file public.secure_file_objects%rowtype;
  v_active_hold boolean;
  v_active_retention boolean;
begin
  if p_status not in ('blocked_legal_hold','deferred_retention','completed','failed') then raise exception 'Invalid deletion completion status'; end if;
  select * into v_request from public.file_deletion_requests
  where id=p_request_id and status='processing' and claim_token=p_claim_token and claimed_by=left(trim(p_worker_id),200)
    and claim_expires_at>now()
  for update;
  if not found then raise exception 'Matching active deletion claim not found'; end if;
  select * into v_file from public.secure_file_objects where id=v_request.secure_file_id for update;
  if not found then raise exception 'Claimed secure file was not found'; end if;
  v_active_hold:=private.file_is_on_legal_hold(v_request.secure_file_id);
  v_active_retention:=v_file.retention_until is not null and v_file.retention_until>now();

  if p_status='blocked_legal_hold' then
    if p_storage_removal_started then raise exception 'A partially removed file cannot be restored as legally held'; end if;
    if not v_active_hold then raise exception 'The file is not on an active legal hold'; end if;
    if v_request.completion_outcome='partial_deletion' then
      update public.secure_file_objects set availability_status='blocked',updated_at=now() where id=v_file.id;
    elsif v_file.availability_status='pending_delete' then
      update public.secure_file_objects set availability_status='released',delete_requested_at=null,updated_at=now() where id=v_file.id;
    end if;
  elsif p_status='deferred_retention' then
    if p_storage_removal_started then raise exception 'A partially removed file cannot be restored as retained'; end if;
    if p_eligible_at is null or p_eligible_at<=now() then raise exception 'A future eligibility time is required for retention deferral'; end if;
    if v_request.completion_outcome='partial_deletion' then
      update public.secure_file_objects set availability_status='blocked',updated_at=now() where id=v_file.id;
    elsif v_file.availability_status='pending_delete' then
      update public.secure_file_objects set availability_status='released',delete_requested_at=null,updated_at=now() where id=v_file.id;
    end if;
  elsif p_status='completed' then
    if not p_storage_removal_started and v_file.availability_status<>'deleted' then
      raise exception 'Completed deletion requires verified Storage removal';
    end if;
    update public.upload_quota_reservations set status='released',updated_at=now()
    where secure_file_id=v_file.id and status in ('reserved','committed');
    update public.secure_file_objects set availability_status='deleted',deleted_at=coalesce(deleted_at,now()),
      delete_requested_at=coalesce(delete_requested_at,now()),updated_at=now()
    where id=v_file.id returning * into v_file;
  elsif p_status='failed' and nullif(trim(p_last_error),'') is null then
    raise exception 'A failure summary is required';
  end if;

  if p_status='failed' and p_storage_removal_started then
    update public.secure_file_objects set availability_status='blocked',updated_at=now()
    where id=v_file.id and availability_status<>'deleted' returning * into v_file;
  end if;

  update public.file_deletion_requests set status=p_status,
    eligible_at=case when p_status='deferred_retention' then p_eligible_at else null end,
    last_error=case when p_status='failed' then left(trim(p_last_error),2000) else last_error end,
    failure_count=case when p_status='failed' then failure_count+1 else failure_count end,
    next_attempt_at=case when p_status='failed' then now()+(
      least(3600::numeric,30::numeric*power(2::numeric,least(failure_count,7))) * interval '1 second'
    ) else null end,
    completion_outcome=case
      when v_request.completion_outcome='partial_deletion' and p_status in ('blocked_legal_hold','deferred_retention','failed') then 'partial_deletion'
      when p_status='completed' then case when v_active_hold or v_active_retention then 'late_governance_conflict' else 'normal' end
      when p_status='failed' and (p_storage_removal_started or v_request.completion_outcome='partial_deletion') then 'partial_deletion'
      else null
    end,
    processed_at=case when p_status='completed' then now() else null end,
    claim_token=null,claimed_at=null,claimed_by=null,claim_expires_at=null,updated_at=now()
  where id=p_request_id and status='processing' and claim_token=p_claim_token and claimed_by=left(trim(p_worker_id),200)
    and claim_expires_at>now()
  returning * into v_request;
  if not found then raise exception 'Deletion claim changed before completion'; end if;
  insert into public.audit_events(institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash)
  values(v_file.institution_id,v_file.course_id,v_file.assignment_id,v_file.id,
    case p_status
      when 'completed' then case when v_active_hold or v_active_retention
        then 'delete.completed_with_late_governance_conflict' else 'retention.delete_completed' end
      when 'blocked_legal_hold' then 'retention.delete_blocked_hold'
      when 'deferred_retention' then 'retention.delete_deferred'
      else case when p_storage_removal_started then 'delete.partial_failure' else 'retention.delete_failed' end
    end,
    'secure_file',v_file.id::text,
    jsonb_build_object('deletion_request_id',v_request.id,'worker_id',left(trim(p_worker_id),200),
      'status',p_status,'eligible_at',v_request.eligible_at,'error',v_request.last_error,
      'failure_count',v_request.failure_count,'next_attempt_at',v_request.next_attempt_at,
      'active_hold_at_finish',v_active_hold,'active_retention_at_finish',v_active_retention,
      'retention_until',v_file.retention_until,'deleted_at',v_file.deleted_at,
      'storage_removal_started',p_storage_removal_started,
      'severity',case when (p_status='completed' and (v_active_hold or v_active_retention))
                           or p_storage_removal_started or v_request.completion_outcome='partial_deletion'
                      then 'high' else 'normal' end), '');
  return v_request;
end;
$$;

create or replace function public.claim_expired_uploads(
  p_worker_id text,
  p_limit integer default 25,
  p_claim_ttl interval default interval '10 minutes'
)
returns table(secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_worker_id),'') is null then raise exception 'Worker identifier is required'; end if;
  if p_claim_ttl is null or p_claim_ttl<interval '1 minute' or p_claim_ttl>interval '1 hour' then raise exception 'Claim lifetime must be from 1 minute to 1 hour'; end if;
  return query
  with candidates as (
    select f.id from public.secure_file_objects f
    where f.upload_status in ('reserved','uploading') and f.upload_expires_at<=now()
      and not private.file_is_on_legal_hold(f.id)
      and (f.expiration_next_attempt_at is null or f.expiration_next_attempt_at<=now())
      and (f.expiration_claim_token is null or f.expiration_claim_expires_at is null or f.expiration_claim_expires_at<=now())
    order by f.upload_expires_at
    for update of f skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  ), claimed as (
    update public.secure_file_objects f set expiration_claim_token=gen_random_uuid(),expiration_claimed_at=now(),
      expiration_claimed_by=left(trim(p_worker_id),200),expiration_claim_expires_at=now()+p_claim_ttl,updated_at=now()
    from candidates c where f.id=c.id
    returning f.id,f.expiration_claim_token,f.expiration_claimed_at,to_jsonb(f) file_data
  )
  select c.id,c.expiration_claim_token,c.expiration_claimed_at,c.file_data from claimed c;
end;
$$;

create or replace function public.finish_expired_upload_claim(
  p_secure_file_id uuid,
  p_claim_token uuid,
  p_worker_id text,
  p_succeeded boolean,
  p_last_error text default null
)
returns public.secure_file_objects
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.secure_file_objects%rowtype; v_active_hold boolean;
begin
  select * into v_file from public.secure_file_objects
  where id=p_secure_file_id and expiration_claim_token=p_claim_token and expiration_claimed_by=left(trim(p_worker_id),200)
    and expiration_claim_expires_at>now()
  for update;
  if not found then raise exception 'Matching expired-upload claim not found'; end if;
  v_active_hold:=private.file_is_on_legal_hold(p_secure_file_id);
  if v_active_hold and not p_succeeded then
    update public.secure_file_objects set expiration_claim_token=null,expiration_claimed_at=null,expiration_claimed_by=null,
      expiration_claim_expires_at=null,expiration_completion_outcome=null,updated_at=now()
    where id=p_secure_file_id returning * into v_file;
    insert into public.audit_events(institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash)
    values(v_file.institution_id,v_file.course_id,v_file.assignment_id,v_file.id,'upload.expiration_blocked_hold','secure_file',v_file.id::text,
      jsonb_build_object('worker_id',left(trim(p_worker_id),200)), '');
    return v_file;
  end if;
  if p_succeeded then
    update public.upload_quota_reservations set status='expired',updated_at=now()
    where secure_file_id=p_secure_file_id and status in ('reserved','committed');
    update public.secure_file_objects set upload_status='expired',availability_status='deleted',deleted_at=now(),
      expiration_claim_token=null,expiration_claimed_at=null,expiration_claimed_by=null,
      expiration_claim_expires_at=null,
      expiration_failure_count=0,expiration_last_error=null,expiration_next_attempt_at=null,
      expiration_completion_outcome=case when v_active_hold then 'late_governance_conflict' else 'normal' end,updated_at=now()
    where id=p_secure_file_id and upload_status in ('reserved','uploading')
      and expiration_claim_token=p_claim_token and expiration_claimed_by=left(trim(p_worker_id),200)
      and expiration_claim_expires_at>now()
    returning * into v_file;
  else
    if nullif(trim(p_last_error),'') is null then raise exception 'An expired-upload failure summary is required'; end if;
    update public.secure_file_objects set expiration_claim_token=null,expiration_claimed_at=null,expiration_claimed_by=null,
      expiration_claim_expires_at=null,
      expiration_failure_count=expiration_failure_count+1,expiration_last_error=left(trim(p_last_error),2000),
      expiration_next_attempt_at=now()+(
        least(3600::numeric,30::numeric*power(2::numeric,least(expiration_failure_count,7))) * interval '1 second'
      ),expiration_completion_outcome=null,updated_at=now()
    where id=p_secure_file_id and expiration_claim_token=p_claim_token and expiration_claimed_by=left(trim(p_worker_id),200)
      and expiration_claim_expires_at>now()
    returning * into v_file;
  end if;
  if not found then raise exception 'Expired-upload claim changed before completion'; end if;
  insert into public.audit_events(institution_id,course_id,assignment_id,secure_file_id,event_type,target_type,target_id,details,event_hash)
  values(v_file.institution_id,v_file.course_id,v_file.assignment_id,v_file.id,
    case when p_succeeded and v_active_hold then 'upload.expiration_completed_with_late_governance_conflict'
      when p_succeeded then 'upload.expired' else 'upload.expiration_failed' end,
    'secure_file',v_file.id::text,jsonb_build_object('worker_id',left(trim(p_worker_id),200),'succeeded',p_succeeded,
      'error',case when p_succeeded then null else left(trim(p_last_error),2000) end,
      'failure_count',v_file.expiration_failure_count,'next_attempt_at',v_file.expiration_next_attempt_at,
      'active_hold_at_finish',v_active_hold,'deleted_at',v_file.deleted_at,
      'severity',case when p_succeeded and v_active_hold then 'high' else 'normal' end), '');
  return v_file;
end;
$$;

create or replace function public.renew_expired_upload_claim(
  p_secure_file_id uuid,
  p_claim_token uuid,
  p_worker_id text
)
returns table(secure_file_id uuid,claim_token uuid,claimed_at timestamptz,file_data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare v_file public.secure_file_objects%rowtype;
begin
  select * into v_file from public.secure_file_objects
  where id=p_secure_file_id and expiration_claim_token=p_claim_token and expiration_claimed_by=left(trim(p_worker_id),200)
    and upload_status in ('reserved','uploading') and upload_expires_at<=now()
    and expiration_claim_expires_at>now()
  for update;
  if not found then raise exception 'Matching active expired-upload claim not found'; end if;
  if private.file_is_on_legal_hold(p_secure_file_id) then raise exception 'Expired upload is now on an active legal hold'; end if;
  update public.secure_file_objects set expiration_claimed_at=now(),expiration_claim_expires_at=now()+interval '10 minutes',updated_at=now()
  where id=p_secure_file_id and expiration_claim_token=p_claim_token and expiration_claimed_by=left(trim(p_worker_id),200)
    and expiration_claim_expires_at>now()
  returning public.secure_file_objects.expiration_claimed_at into v_file.expiration_claimed_at;
  return query select v_file.id,p_claim_token,v_file.expiration_claimed_at,to_jsonb(v_file);
end;
$$;

revoke all on function public.request_secure_file_deletion(uuid,text) from public, anon;
grant execute on function public.request_secure_file_deletion(uuid,text) to authenticated;
revoke all on function private.claim_file_deletion_candidates(text,integer,interval,uuid) from public;
revoke all on function public.claim_file_deletion_requests(text,integer,interval) from public, anon, authenticated;
revoke all on function public.claim_file_deletion_request(uuid,text,interval) from public, anon, authenticated;
revoke all on function public.renew_file_deletion_claim(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.finish_file_deletion_claim(uuid,uuid,text,text,timestamptz,text,boolean) from public, anon, authenticated;
revoke all on function public.claim_expired_uploads(text,integer,interval) from public, anon, authenticated;
revoke all on function public.finish_expired_upload_claim(uuid,uuid,text,boolean,text) from public, anon, authenticated;
revoke all on function public.renew_expired_upload_claim(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_file_deletion_requests(text,integer,interval) to service_role;
grant execute on function public.claim_file_deletion_request(uuid,text,interval) to service_role;
grant execute on function public.renew_file_deletion_claim(uuid,uuid,text) to service_role;
grant execute on function public.finish_file_deletion_claim(uuid,uuid,text,text,timestamptz,text,boolean) to service_role;
grant execute on function public.claim_expired_uploads(text,integer,interval) to service_role;
grant execute on function public.finish_expired_upload_claim(uuid,uuid,text,boolean,text) to service_role;
grant execute on function public.renew_expired_upload_claim(uuid,uuid,text) to service_role;
