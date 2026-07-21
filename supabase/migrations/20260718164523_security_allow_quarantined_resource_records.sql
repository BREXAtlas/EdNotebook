alter table public.learning_resources drop constraint if exists learning_resources_location_check;
alter table public.learning_resources add constraint learning_resources_location_check check (
  (
    storage_mode='cloud'
    and (
      (secure_file_id is not null)
      or (bucket_id is not null and storage_path is not null)
    )
  )
  or (storage_mode='external' and external_url is not null)
  or storage_mode in ('device','metadata')
);
