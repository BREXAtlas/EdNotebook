alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.storage_plan_limits enable row level security;
alter table public.secure_file_objects enable row level security;
alter table public.file_previews enable row level security;
alter table public.upload_quota_reservations enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.retention_policies enable row level security;
alter table public.legal_holds enable row level security;
alter table public.legal_hold_files enable row level security;
alter table public.file_deletion_requests enable row level security;
alter table public.link_previews enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.stripe_price_plan_map enable row level security;
alter table public.entitlement_definitions enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.publication_entitlements enable row level security;
alter table public.stripe_webhook_events enable row level security;

revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke all on public.institutions,public.institution_memberships,public.storage_plan_limits,
  public.secure_file_objects,public.file_previews,public.upload_quota_reservations,
  public.processing_jobs,public.audit_events,public.retention_policies,public.legal_holds,
  public.legal_hold_files,public.file_deletion_requests,public.link_previews,
  public.billing_customers,public.billing_subscriptions,public.stripe_price_plan_map,
  public.entitlement_definitions,public.plan_entitlements,public.user_entitlements,
  public.publication_entitlements,public.stripe_webhook_events from anon,authenticated;

grant select,insert,update,delete on public.institutions,public.institution_memberships to authenticated;
grant select on public.storage_plan_limits to authenticated;
grant select on public.secure_file_objects,public.file_previews,public.upload_quota_reservations,public.audit_events to authenticated;
grant select,insert,update,delete on public.retention_policies,public.legal_holds,public.legal_hold_files to authenticated;
grant select on public.file_deletion_requests,public.link_previews to authenticated;
grant select on public.billing_customers,public.billing_subscriptions,public.entitlement_definitions,
  public.plan_entitlements,public.user_entitlements,public.publication_entitlements to authenticated;

create policy institutions_select on public.institutions
for select to authenticated
using (
  owner_id=(select auth.uid())
  or exists (select 1 from public.institution_memberships im where im.institution_id=id and im.user_id=(select auth.uid()))
  or private.is_platform_manager()
);
create policy institutions_insert on public.institutions
for insert to authenticated
with check (owner_id=(select auth.uid()));
create policy institutions_update on public.institutions
for update to authenticated
using (private.is_institution_manager(id,(select auth.uid())))
with check (private.is_institution_manager(id,(select auth.uid())));
create policy institutions_delete on public.institutions
for delete to authenticated
using (owner_id=(select auth.uid()) or private.is_platform_manager());

create policy institution_memberships_select on public.institution_memberships
for select to authenticated
using (user_id=(select auth.uid()) or private.is_institution_manager(institution_id,(select auth.uid())));
create policy institution_memberships_insert on public.institution_memberships
for insert to authenticated
with check (private.is_institution_manager(institution_id,(select auth.uid())));
create policy institution_memberships_update on public.institution_memberships
for update to authenticated
using (private.is_institution_manager(institution_id,(select auth.uid())))
with check (private.is_institution_manager(institution_id,(select auth.uid())));
create policy institution_memberships_delete on public.institution_memberships
for delete to authenticated
using (private.is_institution_manager(institution_id,(select auth.uid())));

create policy storage_plan_limits_select on public.storage_plan_limits
for select to authenticated using (active);

create policy secure_file_objects_select on public.secure_file_objects
for select to authenticated
using (private.can_access_secure_file(id,(select auth.uid())));

create policy file_previews_select on public.file_previews
for select to authenticated
using (private.can_access_secure_file(secure_file_id,(select auth.uid())));

create policy quota_reservations_select on public.upload_quota_reservations
for select to authenticated
using (user_id=(select auth.uid()));

create policy audit_events_select on public.audit_events
for select to authenticated
using (
  actor_id=(select auth.uid())
  or (course_id is not null and private.can_manage_course(course_id))
  or (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or private.is_platform_manager()
);

create policy retention_policies_select on public.retention_policies
for select to authenticated
using (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
  or private.is_platform_manager()
);
create policy retention_policies_insert on public.retention_policies
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (
    (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
    or (course_id is not null and private.can_manage_course(course_id))
  )
);
create policy retention_policies_update on public.retention_policies
for update to authenticated
using (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
)
with check (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
);
create policy retention_policies_delete on public.retention_policies
for delete to authenticated
using (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
);

create policy legal_holds_select on public.legal_holds
for select to authenticated
using (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
  or private.is_platform_manager()
);
create policy legal_holds_insert on public.legal_holds
for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (
    (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
    or (course_id is not null and private.can_manage_course(course_id))
  )
);
create policy legal_holds_update on public.legal_holds
for update to authenticated
using (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
)
with check (
  (institution_id is not null and private.is_institution_manager(institution_id,(select auth.uid())))
  or (course_id is not null and private.can_manage_course(course_id))
);
create policy legal_holds_delete on public.legal_holds
for delete to authenticated
using (private.is_platform_manager());

create policy legal_hold_files_select on public.legal_hold_files
for select to authenticated
using (exists (select 1 from public.legal_holds h where h.id=legal_hold_id and (
  (h.institution_id is not null and private.is_institution_manager(h.institution_id,(select auth.uid())))
  or (h.course_id is not null and private.can_manage_course(h.course_id))
)));
create policy legal_hold_files_insert on public.legal_hold_files
for insert to authenticated
with check (added_by=(select auth.uid()) and exists (select 1 from public.legal_holds h where h.id=legal_hold_id and (
  (h.institution_id is not null and private.is_institution_manager(h.institution_id,(select auth.uid())))
  or (h.course_id is not null and private.can_manage_course(h.course_id))
)));
create policy legal_hold_files_delete on public.legal_hold_files
for delete to authenticated
using (exists (select 1 from public.legal_holds h where h.id=legal_hold_id and (
  (h.institution_id is not null and private.is_institution_manager(h.institution_id,(select auth.uid())))
  or (h.course_id is not null and private.can_manage_course(h.course_id))
)));

create policy deletion_requests_select on public.file_deletion_requests
for select to authenticated
using (requested_by=(select auth.uid()) or private.can_manage_secure_file(secure_file_id,(select auth.uid())));

create policy link_previews_select on public.link_previews
for select to authenticated
using (status='ready');

create policy billing_customers_select on public.billing_customers
for select to authenticated using (user_id=(select auth.uid()) or private.is_platform_manager());
create policy billing_subscriptions_select on public.billing_subscriptions
for select to authenticated using (user_id=(select auth.uid()) or private.is_platform_manager());
create policy entitlement_definitions_select on public.entitlement_definitions
for select to authenticated using (true);
create policy plan_entitlements_select on public.plan_entitlements
for select to authenticated using (true);
create policy user_entitlements_select on public.user_entitlements
for select to authenticated using (user_id=(select auth.uid()) or private.is_platform_manager());
create policy publication_entitlements_select on public.publication_entitlements
for select to authenticated using (user_id=(select auth.uid()) or private.is_platform_manager());

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
      and private.can_access_course(course_id)
      and visibility in ('course','public','publisher')
      and (secure_file_id is null or security_status='clean')
    )
  )
);

drop policy if exists learning_resources_insert on public.learning_resources;
create policy learning_resources_insert on public.learning_resources
for insert to authenticated
with check (
  owner_id=(select auth.uid())
  and (course_id is null or private.can_access_course(course_id))
  and (assignment_id is null or private.can_access_assignment(assignment_id))
  and (secure_file_id is null or private.can_access_secure_file(secure_file_id,(select auth.uid())))
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
  owner_id=(select auth.uid())
  or (assignment_id is not null and private.can_manage_assignment(assignment_id))
  or (course_id is not null and private.can_manage_course(course_id))
);

drop policy if exists learning_resources_delete on public.learning_resources;
create policy learning_resources_delete on public.learning_resources
for delete to authenticated
using (
  secure_file_id is null
  and (
    owner_id=(select auth.uid())
    or (assignment_id is not null and private.can_manage_assignment(assignment_id))
    or (course_id is not null and private.can_manage_course(course_id))
  )
);

drop policy if exists publications_select on public.publications;
create policy publications_select on public.publications
for select to authenticated
using (private.can_access_publication(id,(select auth.uid())));
