revoke all on function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.get_my_storage_usage() from public,anon,authenticated;
revoke all on function public.request_secure_file_deletion(uuid,text) from public,anon,authenticated;

alter function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) set schema private;
alter function public.get_my_storage_usage() set schema private;
alter function public.request_secure_file_deletion(uuid,text) set schema private;

revoke all on function private.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function private.get_my_storage_usage() from public,anon;
revoke all on function private.request_secure_file_deletion(uuid,text) from public,anon;
grant execute on function private.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function private.get_my_storage_usage() to authenticated;
grant execute on function private.request_secure_file_deletion(uuid,text) to authenticated;

create function public.reserve_secure_upload(
  p_purpose text,
  p_original_name text,
  p_safe_name text,
  p_claimed_mime_type text,
  p_size_bytes bigint,
  p_course_id uuid default null,
  p_assignment_id uuid default null,
  p_publication_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  secure_file_id uuid,
  quarantine_bucket text,
  quarantine_path text,
  destination_bucket text,
  destination_path text,
  plan_key text,
  quota_bytes bigint,
  max_file_bytes bigint,
  used_bytes bigint,
  reserved_bytes bigint,
  retention_until timestamptz,
  upload_expires_at timestamptz
)
language sql
security invoker
set search_path=''
as $$
  select * from private.reserve_secure_upload(
    p_purpose,p_original_name,p_safe_name,p_claimed_mime_type,p_size_bytes,
    p_course_id,p_assignment_id,p_publication_id,p_metadata
  );
$$;

create function public.get_my_storage_usage()
returns table (
  plan_key text,
  quota_bytes bigint,
  max_file_bytes bigint,
  used_bytes bigint,
  reserved_bytes bigint,
  available_bytes bigint
)
language sql
security invoker
set search_path=''
as $$
  select * from private.get_my_storage_usage();
$$;

create function public.request_secure_file_deletion(p_secure_file_id uuid,p_reason text default '')
returns table (request_id uuid,status text,eligible_at timestamptz)
language sql
security invoker
set search_path=''
as $$
  select * from private.request_secure_file_deletion(p_secure_file_id,p_reason);
$$;

revoke all on function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.get_my_storage_usage() from public,anon;
revoke all on function public.request_secure_file_deletion(uuid,text) from public,anon;
grant execute on function public.reserve_secure_upload(text,text,text,text,bigint,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.get_my_storage_usage() to authenticated;
grant execute on function public.request_secure_file_deletion(uuid,text) to authenticated;

create policy processing_jobs_service on public.processing_jobs for all to service_role using (true) with check (true);
create policy stripe_price_plan_map_service on public.stripe_price_plan_map for all to service_role using (true) with check (true);
create policy stripe_webhook_events_service on public.stripe_webhook_events for all to service_role using (true) with check (true);
