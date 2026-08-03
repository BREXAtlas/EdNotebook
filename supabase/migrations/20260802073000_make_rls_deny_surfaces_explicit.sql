-- Make server-only and governance-only tables explicitly fail closed at the
-- Data API boundary. SECURITY DEFINER RPCs and service-role workers retain
-- their existing access; anon and authenticated receive no direct table API.

revoke all privileges on table private.digital_literacy_standard_enrollments from anon, authenticated;
drop policy if exists digital_literacy_standard_enrollments_api_deny_all on private.digital_literacy_standard_enrollments;
create policy digital_literacy_standard_enrollments_api_deny_all
on private.digital_literacy_standard_enrollments
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table private.digital_literacy_standard_progress from anon, authenticated;
drop policy if exists digital_literacy_standard_progress_api_deny_all on private.digital_literacy_standard_progress;
create policy digital_literacy_standard_progress_api_deny_all
on private.digital_literacy_standard_progress
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table private.research_export_secrets from anon, authenticated;
drop policy if exists research_export_secrets_api_deny_all on private.research_export_secrets;
create policy research_export_secrets_api_deny_all
on private.research_export_secrets
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.lti_launch_sessions from anon, authenticated;
drop policy if exists lti_launch_sessions_api_deny_all on public.lti_launch_sessions;
create policy lti_launch_sessions_api_deny_all
on public.lti_launch_sessions
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.lti_launch_states from anon, authenticated;
drop policy if exists lti_launch_states_api_deny_all on public.lti_launch_states;
create policy lti_launch_states_api_deny_all
on public.lti_launch_states
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.lti_service_endpoints from anon, authenticated;
drop policy if exists lti_service_endpoints_api_deny_all on public.lti_service_endpoints;
create policy lti_service_endpoints_api_deny_all
on public.lti_service_endpoints
as restrictive for all to anon, authenticated
using (false) with check (false);

-- Older Supabase role defaults granted these professor-only mutation RPCs
-- directly to anon even after PUBLIC was revoked. Make the intended browser
-- boundary deterministic across local, staging, and recovery runtimes.
revoke all on function public.save_course_syllabus_draft(uuid,jsonb,text,text,text,text)
from anon;
revoke all on function public.set_course_syllabus_state(uuid,text)
from anon;

revoke all privileges on table public.marketplace_commerce_launch from anon, authenticated;
drop policy if exists marketplace_commerce_launch_api_deny_all on public.marketplace_commerce_launch;
create policy marketplace_commerce_launch_api_deny_all
on public.marketplace_commerce_launch
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.marketplace_launch_controls from anon, authenticated;
drop policy if exists marketplace_launch_controls_api_deny_all on public.marketplace_launch_controls;
create policy marketplace_launch_controls_api_deny_all
on public.marketplace_launch_controls
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_intake_evidence_versions from anon, authenticated;
drop policy if exists student_data_intake_evidence_versions_api_deny_all on public.student_data_intake_evidence_versions;
create policy student_data_intake_evidence_versions_api_deny_all
on public.student_data_intake_evidence_versions
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_intake_gate_definitions from anon, authenticated;
drop policy if exists student_data_intake_gate_definitions_api_deny_all on public.student_data_intake_gate_definitions;
create policy student_data_intake_gate_definitions_api_deny_all
on public.student_data_intake_gate_definitions
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_lifecycle_domains from anon, authenticated;
drop policy if exists student_data_lifecycle_domains_api_deny_all on public.student_data_lifecycle_domains;
create policy student_data_lifecycle_domains_api_deny_all
on public.student_data_lifecycle_domains
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_lifecycle_policy_versions from anon, authenticated;
drop policy if exists student_data_lifecycle_policy_versions_api_deny_all on public.student_data_lifecycle_policy_versions;
create policy student_data_lifecycle_policy_versions_api_deny_all
on public.student_data_lifecycle_policy_versions
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_subject_request_items from anon, authenticated;
drop policy if exists student_data_subject_request_items_api_deny_all on public.student_data_subject_request_items;
create policy student_data_subject_request_items_api_deny_all
on public.student_data_subject_request_items
as restrictive for all to anon, authenticated
using (false) with check (false);

revoke all privileges on table public.student_data_subject_requests from anon, authenticated;
drop policy if exists student_data_subject_requests_api_deny_all on public.student_data_subject_requests;
create policy student_data_subject_requests_api_deny_all
on public.student_data_subject_requests
as restrictive for all to anon, authenticated
using (false) with check (false);
