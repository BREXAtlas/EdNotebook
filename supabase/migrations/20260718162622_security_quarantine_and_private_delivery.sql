insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('ed-quarantine','ed-quarantine',false,5368709120,array[
    'application/octet-stream','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/epub+zip','application/zip','application/x-zip-compressed','application/x-tar','application/gzip',
    'application/json','text/plain','text/markdown','text/csv','text/html',
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'audio/mpeg','audio/wav','audio/mp4','video/mp4','video/webm'
  ]),
  ('ed-previews','ed-previews',false,104857600,array[
    'image/jpeg','image/png','image/webp','application/pdf','text/plain','text/html','application/json'
  ])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

update storage.buckets
set file_size_limit=5368709120
where id in ('ed-private-vault','ed-course-materials','ed-submissions','ed-publications');

drop policy if exists course_materials_delete on storage.objects;
drop policy if exists course_materials_insert on storage.objects;
drop policy if exists course_materials_select on storage.objects;
drop policy if exists course_materials_update on storage.objects;
drop policy if exists private_vault_delete on storage.objects;
drop policy if exists private_vault_insert on storage.objects;
drop policy if exists private_vault_select on storage.objects;
drop policy if exists private_vault_update on storage.objects;
drop policy if exists publications_storage_delete on storage.objects;
drop policy if exists publications_storage_insert on storage.objects;
drop policy if exists publications_storage_select on storage.objects;
drop policy if exists publications_storage_update on storage.objects;
drop policy if exists submissions_delete on storage.objects;
drop policy if exists submissions_insert on storage.objects;
drop policy if exists submissions_select on storage.objects;
drop policy if exists submissions_update on storage.objects;

drop policy if exists quarantine_insert on storage.objects;
drop policy if exists quarantine_update on storage.objects;

create policy quarantine_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='ed-quarantine'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.secure_file_objects s
    where s.id=((storage.foldername(name))[2])::uuid
      and s.owner_id=(select auth.uid())
      and s.quarantine_path=name
      and s.upload_status in ('reserved','uploading')
      and s.upload_expires_at > now()
  )
);

create policy quarantine_update on storage.objects
for update to authenticated
using (
  bucket_id='ed-quarantine'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.secure_file_objects s
    where s.id=((storage.foldername(name))[2])::uuid
      and s.owner_id=(select auth.uid())
      and s.quarantine_path=name
      and s.upload_status in ('reserved','uploading')
      and s.upload_expires_at > now()
  )
)
with check (
  bucket_id='ed-quarantine'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (
    select 1
    from public.secure_file_objects s
    where s.id=((storage.foldername(name))[2])::uuid
      and s.owner_id=(select auth.uid())
      and s.quarantine_path=name
      and s.upload_status in ('reserved','uploading')
      and s.upload_expires_at > now()
  )
);
