-- Close advisor gaps after the Financial Literacy staging preflight.
-- Private tables remain RPC-only; these policies make the deny posture
-- explicit even if a future grant is added accidentally.

create index financial_literacy_enrollment_started_release_idx
  on private.financial_literacy_standard_enrollments(started_release_id,student_id);

create index financial_literacy_badges_release_idx
  on private.financial_literacy_standard_badges(release_id,student_id);

create policy financial_literacy_enrollments_explicit_deny
  on private.financial_literacy_standard_enrollments
  for all to anon,authenticated using (false) with check (false);

create policy financial_literacy_progress_explicit_deny
  on private.financial_literacy_standard_progress
  for all to anon,authenticated using (false) with check (false);

create policy financial_literacy_badges_explicit_deny
  on private.financial_literacy_standard_badges
  for all to anon,authenticated using (false) with check (false);

alter function public.get_financial_literacy_catalog() security invoker;
