-- Final Phase 2 of 5: production-security and student-data intake readiness.
--
-- This migration creates an append-only lifecycle/evidence registry and a
-- fail-closed student data-subject request plan. It does not enable production
-- intake, delete an Auth user, execute a retention disposition, or promote a
-- deployment. Those remain separate reviewed worker and production gates.

create table public.student_data_lifecycle_domains (
  domain_key text primary key check (domain_key ~ '^[a-z][A-Za-z0-9]+$'),
  system_owner text not null,
  record_scope text not null check (record_scope in ('linked_record','account','external_copy','storage','provider','unlinked_form','user_authored_shared')),
  contains_education_record boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.student_data_intake_gate_definitions (
  gate_key text primary key check (gate_key ~ '^[a-z][A-Za-z0-9]+$'),
  category text not null check (category in ('repository','database','storage','lms','security','release','approval')),
  title text not null,
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.student_data_lifecycle_policy_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  domain_key text not null references public.student_data_lifecycle_domains(domain_key) on delete restrict,
  version integer not null check (version > 0),
  disposition text not null check (disposition in ('delete','anonymize','retain','block')),
  retention_days integer check (retention_days between 0 and 36500),
  purpose text not null check (char_length(trim(purpose)) between 20 and 2000),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  review_notes text not null check (char_length(trim(review_notes)) between 20 and 4000),
  status text not null check (status in ('approved','blocked')),
  reviewer_type text not null default 'human' check (reviewer_type='human'),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  review_due_at timestamptz,
  supersedes_policy_id uuid references public.student_data_lifecycle_policy_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id,domain_key,version),
  check (
    (disposition='block' and retention_days is null)
    or (disposition in ('delete','anonymize') and retention_days is not null)
    or (disposition='retain' and retention_days between 1 and 36500)
  ),
  check (review_due_at is null or review_due_at > approved_at)
);

create table public.student_data_intake_evidence_versions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  gate_key text not null references public.student_data_intake_gate_definitions(gate_key) on delete restrict,
  version integer not null check (version > 0),
  status text not null check (status in ('passed','failed','hold')),
  evidence_reference text not null check (char_length(trim(evidence_reference)) between 8 and 500),
  summary text not null check (char_length(trim(summary)) between 20 and 4000),
  tested_commit text,
  migration_version text,
  environment_reference text,
  region text,
  evidence_summary jsonb not null default '{}'::jsonb,
  reviewer_type text not null default 'human' check (reviewer_type='human'),
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  expires_at timestamptz,
  supersedes_evidence_id uuid references public.student_data_intake_evidence_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (institution_id,gate_key,version),
  check (tested_commit is null or tested_commit ~ '^[0-9a-f]{7,64}$'),
  check (expires_at is null or expires_at > reviewed_at)
);

create table public.student_data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  subject_user_id uuid not null references public.profiles(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  request_type text not null check (request_type in ('access_export','correction','account_closure','deletion','anonymization')),
  reason text not null check (char_length(trim(reason)) between 20 and 2000),
  status text not null default 'policy_review'
    check (status in ('policy_review','blocked','approved_for_worker','processing','completed','failed','cancelled')),
  intake_decision text not null default 'hold' check (intake_decision='hold'),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  completed_at timestamptz,
  failure_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index student_data_subject_requests_active_idx
  on public.student_data_subject_requests(institution_id,subject_user_id,request_type)
  where status in ('policy_review','blocked','approved_for_worker','processing');

create table public.student_data_subject_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.student_data_subject_requests(id) on delete cascade,
  domain_key text not null references public.student_data_lifecycle_domains(domain_key) on delete restrict,
  policy_version_id uuid references public.student_data_lifecycle_policy_versions(id) on delete restrict,
  disposition text check (disposition in ('delete','anonymize','retain','block')),
  status text not null check (status in ('blocked_missing_policy','planned','processing','deleted','anonymized','retained','blocked','failed')),
  outcome_summary text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id,domain_key)
);

create index student_data_lifecycle_policy_versions_approved_by_idx
  on public.student_data_lifecycle_policy_versions(approved_by);
create index student_data_lifecycle_policy_versions_supersedes_idx
  on public.student_data_lifecycle_policy_versions(supersedes_policy_id);
create index student_data_intake_evidence_versions_reviewed_by_idx
  on public.student_data_intake_evidence_versions(reviewed_by);
create index student_data_intake_evidence_versions_supersedes_idx
  on public.student_data_intake_evidence_versions(supersedes_evidence_id);
create index student_data_subject_requests_subject_idx
  on public.student_data_subject_requests(subject_user_id,requested_at desc);
create index student_data_subject_requests_institution_status_idx
  on public.student_data_subject_requests(institution_id,status,requested_at desc);
create index student_data_subject_requests_requested_by_idx
  on public.student_data_subject_requests(requested_by);
create index student_data_subject_requests_reviewed_by_idx
  on public.student_data_subject_requests(reviewed_by);
create index student_data_subject_request_items_request_idx
  on public.student_data_subject_request_items(request_id,status);
create index student_data_subject_request_items_policy_idx
  on public.student_data_subject_request_items(policy_version_id);

alter table public.student_data_lifecycle_domains enable row level security;
alter table public.student_data_intake_gate_definitions enable row level security;
alter table public.student_data_lifecycle_policy_versions enable row level security;
alter table public.student_data_intake_evidence_versions enable row level security;
alter table public.student_data_subject_requests enable row level security;
alter table public.student_data_subject_request_items enable row level security;

-- Adopting the 2026 Data API explicit-grant behavior now keeps later schema
-- changes fail closed. Existing objects and their current grants are unchanged.
alter default privileges for role postgres in schema public
  revoke select,insert,update,delete on tables from anon,authenticated;
alter default privileges for role postgres in schema public
  revoke usage,select on sequences from anon,authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public,anon;

revoke all on table
  public.student_data_lifecycle_domains,
  public.student_data_intake_gate_definitions,
  public.student_data_lifecycle_policy_versions,
  public.student_data_intake_evidence_versions,
  public.student_data_subject_requests,
  public.student_data_subject_request_items
from public,anon,authenticated;

grant select on table
  public.student_data_lifecycle_domains,
  public.student_data_intake_gate_definitions,
  public.student_data_lifecycle_policy_versions,
  public.student_data_intake_evidence_versions,
  public.student_data_subject_requests,
  public.student_data_subject_request_items
to service_role;

grant insert on table
  public.student_data_lifecycle_policy_versions,
  public.student_data_intake_evidence_versions,
  public.student_data_subject_requests,
  public.student_data_subject_request_items
to service_role;

grant update on table
  public.student_data_subject_requests,
  public.student_data_subject_request_items
to service_role;

-- Critical deletion/retention workers must not depend on historical default
-- table privileges. Keep their trusted server role explicit and narrow.
grant select,update on table
  public.file_deletion_requests,
  public.secure_file_objects,
  public.upload_quota_reservations,
  public.legal_holds
to service_role;
grant select on table public.audit_events to service_role;
grant select,insert on table public.legal_hold_files to service_role;
grant insert on table public.legal_holds to service_role;

insert into public.student_data_lifecycle_domains(
  domain_key,system_owner,record_scope,contains_education_record
)
select domain_key,'ednotebook','linked_record',true
from unnest(array[
  'profile','identityOnboardingRequests','institutionAccessApplications',
  'institutionAffiliations','institutionMemberships','institutionTransferRequests',
  'courseMemberships','studentEnrollmentRequests','studentRosterEntries',
  'assignmentDrafts','assignmentFormSubmissions','assignmentDocumentFeedback',
  'courseLessonProgress','courseProgress','studentGrades','gradeShareLinks',
  'learningMessages','courseCommunicationReads','courseCommunicationPreferences',
  'learningResources','studentLearningRecords','studentPublicProfile','studentGroups',
  'studentGroupMemberships','studentPosts','readingAnnotations','studentEducationPath',
  'educatorVerificationRequests','secureFiles','filePreviews','processingJobs',
  'linkPreviews','uploadQuotaReservations','fileDeletionRequests','legalHoldFiles',
  'publicationEntitlements','billingCustomers','billingSubscriptions','userEntitlements',
  'blackboardIdentityMappings','blackboardGradeExportSnapshots','learningSystemIdentifiers',
  'ltiUserMappings','ltiContextMemberships','ltiLaunchSessions','ltiGradeSyncEvents',
  'userFeaturePolicies','studentDataSubjectRequests','studentDataSubjectRequestItems',
  'auditEvents'
]::text[]) as domain_key
on conflict (domain_key) do update set active=true;

insert into public.student_data_lifecycle_domains(
  domain_key,system_owner,record_scope,contains_education_record
) values
  ('authIdentities','supabase_auth','account',true),
  ('authSessions','supabase_auth','account',true),
  ('authProviderLogs','supabase_auth','provider',true),
  ('storageObjectVersions','supabase_storage','storage',true),
  ('storageDeliveryCaches','supabase_storage','storage',true),
  ('providerBackups','supabase','provider',true),
  ('stripeWebhookPayloads','stripe','external_copy',false),
  ('blackboardProviderCopies','blackboard','external_copy',true),
  ('ltiProviderCopies','lti_platform','external_copy',true),
  ('unlinkedPortalInterestSubmissions','ednotebook','unlinked_form',false),
  ('userAuthoredProfessorPublisherContent','ednotebook','user_authored_shared',true)
on conflict (domain_key) do update set active=true;

insert into public.student_data_intake_gate_definitions(
  gate_key,category,title,description
) values
  ('repositoryValidation','repository','Repository validation','The exact candidate passes focused safety tests, full CI, build, and credential inspection.'),
  ('databaseRestore','database','Database restore','A provider backup or PITR restore reconciles canonical row counts and hashes.'),
  ('storageRestore','storage','Private Storage restore','Separately backed-up private objects reconcile by path, bytes, and SHA-256.'),
  ('crossTenantAccess','database','Cross-tenant access','Authenticated synthetic users pass the hosted tenant-isolation rehearsal.'),
  ('blackboardRoundTrip','lms','Blackboard round trip','A synthetic export is re-imported or reconciled in an institution-controlled non-production course.'),
  ('storageDeletionRetention','storage','Storage deletion and holds','Real synthetic private objects prove delete, retain, legal-hold, and partial-failure behavior.'),
  ('securityAdvisors','security','Security advisors','Every current security advisor finding is resolved or formally accepted.'),
  ('performanceAdvisors','security','Performance advisors','Every intake-relevant performance finding is resolved or formally accepted.'),
  ('protectedReleaseBranch','release','Protected release branch','Required checks protect the deployment branch for the exact candidate.'),
  ('technologyApproval','approval','Institution technology approval','An accountable institution technology reviewer accepts the exact environment and candidate.'),
  ('privacyRecordsApproval','approval','Privacy and records approval','An accountable privacy or records reviewer accepts the lifecycle matrix and retention periods.'),
  ('accessibilityApproval','approval','Accessibility approval','An accountable accessibility reviewer accepts the student intake experience.'),
  ('securityApproval','approval','Security approval','An accountable security reviewer accepts the evidence, residual risk, and incident boundary.')
on conflict (gate_key) do update set active=true;

create or replace function private.reject_student_data_governance_mutation()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  raise exception 'Student-data governance evidence is append-only';
end;
$$;

create trigger student_data_lifecycle_policy_versions_append_only
before update or delete on public.student_data_lifecycle_policy_versions
for each row execute function private.reject_student_data_governance_mutation();

create trigger student_data_intake_evidence_versions_append_only
before update or delete on public.student_data_intake_evidence_versions
for each row execute function private.reject_student_data_governance_mutation();

create or replace function private.student_data_intake_readiness(p_institution_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  with current_policies as (
    select distinct on (policy.domain_key) policy.*
    from public.student_data_lifecycle_policy_versions policy
    where policy.institution_id=p_institution_id
    order by policy.domain_key,policy.version desc
  ), current_evidence as (
    select distinct on (evidence.gate_key) evidence.*
    from public.student_data_intake_evidence_versions evidence
    where evidence.institution_id=p_institution_id
    order by evidence.gate_key,evidence.version desc
  ), policy_summary as (
    select
      count(*) filter (where domain.active) as required_count,
      count(policy.id) filter (
        where domain.active and policy.status='approved'
          and policy.reviewer_type='human'
          and policy.approved_at<=now()
          and (policy.review_due_at is null or policy.review_due_at>now())
      ) as approved_count,
      coalesce(jsonb_agg(domain.domain_key order by domain.domain_key) filter (
        where domain.active and (
          policy.id is null or policy.status<>'approved'
          or policy.reviewer_type<>'human'
          or policy.approved_at>now()
          or (policy.review_due_at is not null and policy.review_due_at<=now())
        )
      ),'[]'::jsonb) as missing
    from public.student_data_lifecycle_domains domain
    left join current_policies policy on policy.domain_key=domain.domain_key
  ), evidence_summary as (
    select
      count(*) filter (where gate.active) as required_count,
      count(evidence.id) filter (
        where gate.active and evidence.status='passed'
          and evidence.reviewer_type='human'
          and evidence.reviewed_at<=now()
          and (evidence.expires_at is null or evidence.expires_at>now())
      ) as passed_count,
      coalesce(jsonb_agg(gate.gate_key order by gate.gate_key) filter (
        where gate.active and (
          evidence.id is null or evidence.status<>'passed'
          or evidence.reviewer_type<>'human'
          or evidence.reviewed_at>now()
          or (evidence.expires_at is not null and evidence.expires_at<=now())
        )
      ),'[]'::jsonb) as missing
    from public.student_data_intake_gate_definitions gate
    left join current_evidence evidence on evidence.gate_key=gate.gate_key
  )
  select jsonb_build_object(
    'decision',case when policy_summary.approved_count=policy_summary.required_count
                          and evidence_summary.passed_count=evidence_summary.required_count
                     then 'ready_for_human_promotion_review' else 'hold' end,
    'ready_for_promotion_review',policy_summary.approved_count=policy_summary.required_count
      and evidence_summary.passed_count=evidence_summary.required_count,
    'production_student_intake_enabled',false,
    'lifecycle_domain_count',policy_summary.required_count,
    'approved_lifecycle_domain_count',policy_summary.approved_count,
    'required_evidence_gate_count',evidence_summary.required_count,
    'passed_evidence_gate_count',evidence_summary.passed_count,
    'missing_lifecycle_domains',policy_summary.missing,
    'missing_evidence_gates',evidence_summary.missing,
    'policies',coalesce((select jsonb_agg(to_jsonb(policy) order by policy.domain_key) from current_policies policy),'[]'::jsonb),
    'evidence',coalesce((select jsonb_agg(to_jsonb(evidence) order by evidence.gate_key) from current_evidence evidence),'[]'::jsonb),
    'subject_requests',coalesce((
      select jsonb_agg(to_jsonb(request_record) order by request_record.requested_at desc)
      from (
        select * from public.student_data_subject_requests request_source
        where request_source.institution_id=p_institution_id
        order by request_source.requested_at desc
        limit 100
      ) request_record
    ),'[]'::jsonb)
  )
  from policy_summary,evidence_summary;
$$;

create or replace function public.get_student_data_intake_readiness(p_institution_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then
    raise exception 'Student-data readiness access denied';
  end if;
  return private.student_data_intake_readiness(p_institution_id);
end;
$$;

create or replace function public.record_student_data_lifecycle_policy(
  p_institution_id uuid,
  p_domain_key text,
  p_disposition text,
  p_retention_days integer,
  p_purpose text,
  p_evidence_reference text,
  p_review_notes text,
  p_status text default 'approved',
  p_review_due_at timestamptz default null,
  p_attestation boolean default false
)
returns public.student_data_lifecycle_policy_versions
language plpgsql
security definer
set search_path=''
as $$
declare
  v_previous public.student_data_lifecycle_policy_versions%rowtype;
  v_record public.student_data_lifecycle_policy_versions%rowtype;
  v_version integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Lifecycle-policy review denied'; end if;
  if not p_attestation then raise exception 'Human lifecycle-policy attestation required'; end if;
  if p_status not in ('approved','blocked') then raise exception 'Lifecycle-policy status is invalid'; end if;
  if p_disposition not in ('delete','anonymize','retain','block') then raise exception 'Lifecycle disposition is invalid'; end if;
  if not exists(select 1 from public.student_data_lifecycle_domains where domain_key=p_domain_key and active) then
    raise exception 'Lifecycle domain is not active';
  end if;
  if char_length(trim(coalesce(p_purpose,'')))<20
     or char_length(trim(coalesce(p_evidence_reference,'')))<8
     or char_length(trim(coalesce(p_review_notes,'')))<20 then
    raise exception 'Purpose, evidence reference, and review notes are required';
  end if;
  if (p_disposition='block' and p_retention_days is not null)
     or (p_disposition in ('delete','anonymize') and (p_retention_days is null or p_retention_days not between 0 and 36500))
     or (p_disposition='retain' and (p_retention_days is null or p_retention_days not between 1 and 36500)) then
    raise exception 'Retention period does not match the lifecycle disposition';
  end if;
  if p_review_due_at is not null and p_review_due_at<=now() then raise exception 'Review due date must be in the future'; end if;

  select * into v_previous
  from public.student_data_lifecycle_policy_versions
  where institution_id=p_institution_id and domain_key=p_domain_key
  order by version desc
  limit 1
  for update;
  v_version:=coalesce(v_previous.version,0)+1;

  insert into public.student_data_lifecycle_policy_versions(
    institution_id,domain_key,version,disposition,retention_days,purpose,
    evidence_reference,review_notes,status,approved_by,approved_at,review_due_at,
    supersedes_policy_id
  ) values (
    p_institution_id,p_domain_key,v_version,p_disposition,p_retention_days,trim(p_purpose),
    trim(p_evidence_reference),trim(p_review_notes),p_status,(select auth.uid()),now(),p_review_due_at,
    v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'student_data.lifecycle_policy_recorded','student_data_lifecycle_policy',v_record.id::text,
    jsonb_build_object('domain_key',p_domain_key,'version',v_version,'disposition',p_disposition,'status',p_status), '');
  return v_record;
end;
$$;

create or replace function public.record_student_data_intake_evidence(
  p_institution_id uuid,
  p_gate_key text,
  p_status text,
  p_evidence_reference text,
  p_summary text,
  p_tested_commit text default null,
  p_migration_version text default null,
  p_environment_reference text default null,
  p_region text default null,
  p_evidence_summary jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null,
  p_attestation boolean default false
)
returns public.student_data_intake_evidence_versions
language plpgsql
security definer
set search_path=''
as $$
declare
  v_previous public.student_data_intake_evidence_versions%rowtype;
  v_record public.student_data_intake_evidence_versions%rowtype;
  v_version integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (
    private.is_platform_owner((select auth.uid()))
    or private.has_institution_capability(p_institution_id,'view_audit',(select auth.uid()))
    or private.has_institution_capability(p_institution_id,'manage_retention',(select auth.uid()))
  ) then raise exception 'Student-data evidence review denied'; end if;
  if p_status not in ('passed','failed','hold') then raise exception 'Evidence status is invalid'; end if;
  if p_status='passed' and not p_attestation then raise exception 'Human evidence attestation required'; end if;
  if char_length(trim(coalesce(p_evidence_reference,'')))<8 or char_length(trim(coalesce(p_summary,'')))<20 then
    raise exception 'Evidence reference and summary are required';
  end if;
  if p_tested_commit is not null and p_tested_commit !~ '^[0-9a-f]{7,64}$' then raise exception 'Tested commit is invalid'; end if;
  if p_expires_at is not null and p_expires_at<=now() then raise exception 'Evidence expiry must be in the future'; end if;
  if jsonb_typeof(coalesce(p_evidence_summary,'{}'::jsonb))<>'object' then raise exception 'Evidence summary must be an object'; end if;

  select * into v_previous
  from public.student_data_intake_evidence_versions
  where institution_id=p_institution_id and gate_key=p_gate_key
  order by version desc
  limit 1
  for update;
  if not exists(select 1 from public.student_data_intake_gate_definitions where gate_key=p_gate_key and active) then
    raise exception 'Intake evidence gate is not active';
  end if;
  v_version:=coalesce(v_previous.version,0)+1;

  insert into public.student_data_intake_evidence_versions(
    institution_id,gate_key,version,status,evidence_reference,summary,tested_commit,
    migration_version,environment_reference,region,evidence_summary,reviewed_by,
    reviewed_at,expires_at,supersedes_evidence_id
  ) values (
    p_institution_id,p_gate_key,v_version,p_status,trim(p_evidence_reference),trim(p_summary),
    nullif(trim(coalesce(p_tested_commit,'')),''),nullif(trim(coalesce(p_migration_version,'')),''),
    nullif(trim(coalesce(p_environment_reference,'')),''),nullif(trim(coalesce(p_region,'')),''),
    coalesce(p_evidence_summary,'{}'::jsonb),(select auth.uid()),now(),p_expires_at,v_previous.id
  ) returning * into v_record;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values((select auth.uid()),p_institution_id,'student_data.intake_evidence_recorded','student_data_intake_evidence',v_record.id::text,
    jsonb_build_object('gate_key',p_gate_key,'version',v_version,'status',p_status,'tested_commit',v_record.tested_commit), '');
  return v_record;
end;
$$;

create or replace function public.request_my_student_data_action(
  p_institution_id uuid,
  p_request_type text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_request public.student_data_subject_requests%rowtype;
  v_missing integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_request_type not in ('access_export','correction','account_closure','deletion','anonymization') then
    raise exception 'Student data-subject request type is invalid';
  end if;
  if char_length(trim(coalesce(p_reason,'')))<20 then raise exception 'A request reason of at least 20 characters is required'; end if;
  if not private.has_active_institution_affiliation(v_user_id,p_institution_id,'student') then
    raise exception 'Active student institution affiliation required';
  end if;

  select * into v_request
  from public.student_data_subject_requests
  where institution_id=p_institution_id and subject_user_id=v_user_id and request_type=p_request_type
    and status in ('policy_review','blocked','approved_for_worker','processing')
  order by requested_at desc
  limit 1;
  if found then
    return jsonb_build_object('request',to_jsonb(v_request),'created',false,'production_action_executed',false);
  end if;

  insert into public.student_data_subject_requests(
    institution_id,subject_user_id,requested_by,request_type,reason,status,intake_decision
  ) values (p_institution_id,v_user_id,v_user_id,p_request_type,trim(p_reason),'policy_review','hold')
  returning * into v_request;

  with current_policies as (
    select distinct on (policy.domain_key) policy.*
    from public.student_data_lifecycle_policy_versions policy
    where policy.institution_id=p_institution_id
    order by policy.domain_key,policy.version desc
  )
  insert into public.student_data_subject_request_items(
    request_id,domain_key,policy_version_id,disposition,status
  )
  select v_request.id,domain.domain_key,policy.id,policy.disposition,
    case when policy.id is not null and policy.status='approved'
                   and policy.reviewer_type='human' and policy.approved_at<=now()
                   and (policy.review_due_at is null or policy.review_due_at>now())
         then 'planned' else 'blocked_missing_policy' end
  from public.student_data_lifecycle_domains domain
  left join current_policies policy on policy.domain_key=domain.domain_key
  where domain.active;

  select count(*) into v_missing
  from public.student_data_subject_request_items
  where request_id=v_request.id and status='blocked_missing_policy';
  if v_missing>0 then
    update public.student_data_subject_requests
    set status='blocked',updated_at=now(),failure_summary='Lifecycle policy review is incomplete.'
    where id=v_request.id
    returning * into v_request;
  end if;

  insert into public.audit_events(actor_id,institution_id,event_type,target_type,target_id,details,event_hash)
  values(v_user_id,p_institution_id,'student_data.subject_request_created','student_data_subject_request',v_request.id::text,
    jsonb_build_object('request_type',p_request_type,'status',v_request.status,'missing_policy_count',v_missing,'production_action_executed',false), '');

  return jsonb_build_object('request',to_jsonb(v_request),'created',true,'missing_policy_count',v_missing,'production_action_executed',false);
end;
$$;

create or replace function public.get_my_student_data_subject_requests()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(jsonb_agg(
    to_jsonb(request_record) || jsonb_build_object('items',coalesce((
      select jsonb_agg(to_jsonb(item) order by item.domain_key)
      from public.student_data_subject_request_items item
      where item.request_id=request_record.id
    ),'[]'::jsonb))
    order by request_record.requested_at desc
  ),'[]'::jsonb)
  from public.student_data_subject_requests request_record
  where request_record.subject_user_id=(select auth.uid());
$$;

revoke all on function private.reject_student_data_governance_mutation() from public,anon,authenticated,service_role;
revoke all on function private.student_data_intake_readiness(uuid) from public,anon,authenticated,service_role;

revoke all on function public.get_student_data_intake_readiness(uuid) from public,anon;
revoke all on function public.record_student_data_lifecycle_policy(uuid,text,text,integer,text,text,text,text,timestamptz,boolean) from public,anon;
revoke all on function public.record_student_data_intake_evidence(uuid,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean) from public,anon;
revoke all on function public.request_my_student_data_action(uuid,text,text) from public,anon;
revoke all on function public.get_my_student_data_subject_requests() from public,anon;
grant execute on function public.get_student_data_intake_readiness(uuid) to authenticated;
grant execute on function public.record_student_data_lifecycle_policy(uuid,text,text,integer,text,text,text,text,timestamptz,boolean) to authenticated;
grant execute on function public.record_student_data_intake_evidence(uuid,text,text,text,text,text,text,text,text,jsonb,timestamptz,boolean) to authenticated;
grant execute on function public.request_my_student_data_action(uuid,text,text) to authenticated;
grant execute on function public.get_my_student_data_subject_requests() to authenticated;

-- Supabase's historical default privileges left these SECURITY DEFINER RPCs
-- directly executable by anon even though their migrations revoked PUBLIC.
-- Preserve authenticated product behavior while closing anonymous execution.
revoke all on function public.get_lti_owner_setup() from public,anon;
revoke all on function public.save_lti_platform_registration(uuid,jsonb) from public,anon;
revoke all on function public.save_lti_deployment(uuid,jsonb) from public,anon;
revoke all on function public.map_lti_context(uuid,uuid) from public,anon;
revoke all on function public.activate_tested_lti_deployment(uuid) from public,anon;
revoke all on function public.list_social_learning_managed_roster() from public,anon;
revoke all on function public.issue_social_learning_reward(uuid,uuid,text,text,text,text,integer,text,uuid) from public,anon;
revoke all on function public.correct_social_learning_reward(uuid,text,integer,text,uuid) from public,anon;
grant execute on function public.get_lti_owner_setup() to authenticated;
grant execute on function public.save_lti_platform_registration(uuid,jsonb) to authenticated;
grant execute on function public.save_lti_deployment(uuid,jsonb) to authenticated;
grant execute on function public.map_lti_context(uuid,uuid) to authenticated;
grant execute on function public.activate_tested_lti_deployment(uuid) to authenticated;
grant execute on function public.list_social_learning_managed_roster() to authenticated;
grant execute on function public.issue_social_learning_reward(uuid,uuid,text,text,text,text,integer,text,uuid) to authenticated;
grant execute on function public.correct_social_learning_reward(uuid,text,integer,text,uuid) to authenticated;

-- The signed-out Morrison Library catalog is the one deliberate anonymous
-- SECURITY DEFINER surface. Its result is a safe public projection only;
-- review rows require a signed-in account and remain a safe preview with no
-- content entitlement or checkout availability.
create or replace function public.list_alex_morrison_catalog(
  p_query text default ''
)
returns table (
  item_kind text,
  item_id uuid,
  course_id uuid,
  course_publication_id uuid,
  title text,
  creator_name text,
  description text,
  access_model text,
  listing_status text,
  reading_mode text,
  price_cents integer,
  rental_days integer,
  enrollment_policy text,
  universal_assignment boolean,
  education_division text,
  published_at timestamptz,
  checkout_available boolean,
  marketplace_listing_id uuid,
  currency text
)
language sql
stable
security definer
set search_path=''
as $$
  select catalog.*
  from (
    select
      'course'::text as item_kind,
      directory.course_id as item_id,
      directory.course_id,
      course_publication.id as course_publication_id,
      directory.title,
      directory.professor_display_name as creator_name,
      coalesce(directory.summary,'') as description,
      directory.library_access_model as access_model,
      directory.library_listing_status as listing_status,
      'interactive'::text as reading_mode,
      coalesce(listing.price_cents,directory.library_price_cents) as price_cents,
      coalesce(listing.rental_days,directory.library_rental_days) as rental_days,
      directory.enrollment_policy,
      directory.universal_assignment,
      directory.education_division,
      coalesce(listing.published_at,directory.library_published_at,directory.published_at) as published_at,
      coalesce(private.marketplace_listing_is_ready(listing.id),false) as checkout_available,
      listing.id as marketplace_listing_id,
      coalesce(listing.currency,'usd') as currency
    from public.published_course_directory directory
    join public.course_publications course_publication
      on course_publication.course_id=directory.course_id
     and course_publication.status='published'
    left join public.marketplace_listings listing
      on listing.course_id=directory.course_id
     and listing.access_model=directory.library_access_model
     and listing.status='published'
    where directory.is_listed
      and (
        (
          directory.library_listing_status='published'
          and (directory.library_access_model='open_free' or listing.id is not null)
        )
        or (
          directory.library_listing_status='review'
          and (select auth.uid()) is not null
        )
      )

    union all

    select
      'book'::text,
      publication.id,
      publication.course_id,
      null::uuid,
      publication.title,
      coalesce(nullif(publication.author_name,''),'Professor author'),
      publication.description,
      coalesce(listing.access_model,publication.access_model),
      case when publication.status='review' then 'review' else 'published' end,
      publication.reading_mode,
      coalesce(listing.price_cents,publication.price_cents),
      coalesce(listing.rental_days,publication.rental_days),
      null::text,
      false,
      coalesce(course.education_division,'university'),
      coalesce(listing.published_at,publication.published_at,publication.created_at),
      coalesce(private.marketplace_listing_is_ready(listing.id),false),
      listing.id,
      coalesce(listing.currency,'usd')
    from public.publications publication
    left join public.courses course on course.id=publication.course_id
    left join public.marketplace_listings listing
      on listing.publication_id=publication.id
     and listing.status='published'
    where publication.access_model in ('open','purchase','rental')
      and (
        (
          publication.status='published'
          and (publication.access_model='open' or listing.id is not null)
        )
        or (
          publication.status='review'
          and (select auth.uid()) is not null
        )
      )
  ) catalog
  where coalesce(nullif(trim(p_query),''),'')=''
     or concat_ws(
       ' ',catalog.title,catalog.creator_name,catalog.description,catalog.item_kind
     ) ilike '%'||trim(p_query)||'%'
  order by catalog.published_at desc nulls last,catalog.title
  limit 100;
$$;

revoke all on function public.list_alex_morrison_catalog(text) from public,anon;
grant execute on function public.list_alex_morrison_catalog(text) to anon,authenticated;

comment on table public.student_data_lifecycle_policy_versions is
  'Append-only human-reviewed lifecycle decisions. No row authorizes production intake or automatic deletion.';
comment on table public.student_data_intake_evidence_versions is
  'Append-only metadata-only intake evidence. Student content and credentials are prohibited.';
comment on table public.student_data_subject_requests is
  'Fail-closed student data-subject requests. This migration creates plans only; no production lifecycle worker is activated.';
comment on function public.get_student_data_intake_readiness(uuid) is
  'Authorized readiness view. A complete result permits only separate human production-promotion review.';
