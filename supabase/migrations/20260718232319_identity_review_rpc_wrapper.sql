-- Keep the privileged implementation outside the exposed API schema. The
-- public wrapper runs with caller privileges and delegates only after the
-- private function verifies the caller is a platform manager.

alter function public.review_identity_onboarding(uuid, text) set schema private;

revoke all on function private.review_identity_onboarding(uuid, text) from public;
revoke execute on function private.review_identity_onboarding(uuid, text) from anon;
grant execute on function private.review_identity_onboarding(uuid, text) to authenticated;

create function public.review_identity_onboarding(
  p_user_id uuid,
  p_decision text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.review_identity_onboarding(p_user_id, p_decision);
$$;

revoke all on function public.review_identity_onboarding(uuid, text) from public;
revoke execute on function public.review_identity_onboarding(uuid, text) from anon;
grant execute on function public.review_identity_onboarding(uuid, text) to authenticated;
