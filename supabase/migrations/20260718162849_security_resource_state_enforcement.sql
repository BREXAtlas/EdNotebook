create or replace function private.enforce_learning_resource_security()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_file public.secure_file_objects%rowtype;
begin
  if new.secure_file_id is null then
    if new.storage_mode='cloud' and (new.bucket_id is null or new.storage_path is null) then
      raise exception 'Cloud resources require a secure file or released object path';
    end if;
    if new.security_status is null then new.security_status := 'not_applicable'; end if;
    return new;
  end if;

  select * into v_file from public.secure_file_objects where id=new.secure_file_id;
  if not found then raise exception 'Secure file record not found'; end if;
  if new.owner_id is distinct from v_file.owner_id then raise exception 'Resource owner must match secure file owner'; end if;
  if new.course_id is distinct from v_file.course_id then raise exception 'Resource course must match secure file course'; end if;
  if new.assignment_id is distinct from v_file.assignment_id then raise exception 'Resource assignment must match secure file assignment'; end if;

  new.storage_mode := 'cloud';
  new.size_bytes := coalesce(v_file.actual_size_bytes,v_file.expected_size_bytes);
  new.original_name := v_file.original_name;
  new.safe_name := v_file.safe_name;
  new.mime_type := coalesce(v_file.detected_mime_type,v_file.claimed_mime_type);
  new.checksum_sha256 := v_file.checksum_sha256;
  new.security_status := case
    when v_file.availability_status='released' and v_file.security_status='clean' then 'clean'
    when v_file.availability_status='blocked' then 'blocked'
    else 'quarantined'
  end;
  new.bucket_id := case when v_file.availability_status='released' then v_file.destination_bucket else null end;
  new.storage_path := case when v_file.availability_status='released' then v_file.destination_path else null end;
  return new;
end;
$$;

revoke all on function private.enforce_learning_resource_security() from public;
drop trigger if exists learning_resources_security_state on public.learning_resources;
create trigger learning_resources_security_state
before insert or update of secure_file_id,owner_id,course_id,assignment_id,bucket_id,storage_path,security_status
on public.learning_resources
for each row execute function private.enforce_learning_resource_security();

create or replace function private.sync_released_secure_file()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.availability_status is distinct from old.availability_status
     or new.security_status is distinct from old.security_status
     or new.actual_size_bytes is distinct from old.actual_size_bytes
     or new.detected_mime_type is distinct from old.detected_mime_type
     or new.checksum_sha256 is distinct from old.checksum_sha256 then
    update public.learning_resources r
    set
      bucket_id=case when new.availability_status='released' then new.destination_bucket else null end,
      storage_path=case when new.availability_status='released' then new.destination_path else null end,
      size_bytes=coalesce(new.actual_size_bytes,new.expected_size_bytes),
      mime_type=coalesce(new.detected_mime_type,new.claimed_mime_type),
      checksum_sha256=new.checksum_sha256,
      security_status=case
        when new.availability_status='released' and new.security_status='clean' then 'clean'
        when new.availability_status='blocked' then 'blocked'
        when new.availability_status='deleted' then 'deleted'
        else 'quarantined'
      end,
      deleted_at=case when new.availability_status='deleted' then coalesce(new.deleted_at,now()) else r.deleted_at end,
      updated_at=now()
    where r.secure_file_id=new.id;

    update public.publications p
    set
      bucket_id=case when new.availability_status='released' then new.destination_bucket else p.bucket_id end,
      storage_path=case when new.availability_status='released' then new.destination_path else p.storage_path end,
      preview_status=new.preview_status,
      conversion_status=case
        when new.conversion_status='ready' then 'ready'
        when new.conversion_status='error' then 'failed'
        when new.conversion_status in ('queued','processing') then new.conversion_status
        else p.conversion_status
      end,
      updated_at=now()
    where p.secure_file_id=new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_released_secure_file() from public;
drop trigger if exists secure_file_sync_resources on public.secure_file_objects;
create trigger secure_file_sync_resources
after update on public.secure_file_objects
for each row execute function private.sync_released_secure_file();

create or replace function private.touch_security_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

revoke all on function private.touch_security_updated_at() from public;

do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions','storage_plan_limits','secure_file_objects','upload_quota_reservations',
    'processing_jobs','retention_policies','legal_holds','file_deletion_requests','link_previews',
    'billing_customers','billing_subscriptions','stripe_price_plan_map','entitlement_definitions',
    'plan_entitlements','user_entitlements','publication_entitlements'
  ] loop
    execute format('drop trigger if exists %I_security_touch on public.%I',t,t);
    execute format('create trigger %I_security_touch before update on public.%I for each row execute function private.touch_security_updated_at()',t,t);
  end loop;
end $$;

alter table public.profiles drop constraint if exists profiles_plan_key_fkey;
alter table public.profiles add constraint profiles_plan_key_fkey foreign key (plan_key) references public.storage_plan_limits(plan_key) on update cascade on delete restrict;
