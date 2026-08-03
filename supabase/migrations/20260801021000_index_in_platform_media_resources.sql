-- Cover the immutable snapshot publisher relationship for deletion and audit joins.
create index if not exists course_publication_resources_published_by_idx
  on public.course_publication_resources (published_by);
