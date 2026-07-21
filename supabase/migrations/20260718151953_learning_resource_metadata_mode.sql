alter table public.learning_resources drop constraint learning_resources_storage_mode_check;
alter table public.learning_resources add constraint learning_resources_storage_mode_check check (storage_mode in ('cloud','device','external','metadata'));
alter table public.learning_resources drop constraint learning_resources_check;
alter table public.learning_resources add constraint learning_resources_location_check check (
  (storage_mode='cloud' and bucket_id is not null and storage_path is not null)
  or (storage_mode='external' and external_url is not null)
  or storage_mode in ('device','metadata')
);
