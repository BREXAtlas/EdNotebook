-- An educator workspace role and a verified institution affiliation are
-- separate concepts. Anyone may choose the professor workspace at signup;
-- institutional review controls only the verified affiliation, institution-
-- scoped records, and institution-owned actions.

create or replace function private.assign_requested_workspace_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_requested_role text;
begin
  select coalesce(user_record.raw_user_meta_data->>'requested_role','learner')
  into v_requested_role
  from auth.users user_record
  where user_record.id=new.id;

  -- Professor is a self-selected workspace type. Never accept privileged
  -- owner, admin, security, or records roles from user-editable metadata.
  if new.role='learner' and v_requested_role='professor' then
    new.role := 'professor';
  end if;
  return new;
end;
$$;

revoke all on function private.assign_requested_workspace_role()
from public,anon,authenticated,service_role;

drop trigger if exists profiles_assign_requested_workspace_role on public.profiles;
create trigger profiles_assign_requested_workspace_role
before insert on public.profiles
for each row execute function private.assign_requested_workspace_role();

-- Repair accounts created under the former approval-blocking model. This does
-- not approve an affiliation or activate an institution membership.
update public.profiles profile
set role='professor',updated_at=now()
from public.identity_onboarding_requests request
where request.user_id=profile.id
  and request.requested_role='professor'
  and profile.role='learner';

comment on function private.assign_requested_workspace_role() is
  'Assigns the self-selected professor workspace at profile creation. Institution verification remains governed by identity_onboarding_requests, institution_affiliations, and institution_memberships.';
