-- Cover publication-scoped refresh, evidence, and foreign-key maintenance paths.
create index if not exists media_learning_progress_publication_idx
  on public.media_learning_progress (publication_id,version_number,user_id,status);
