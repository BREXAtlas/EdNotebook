-- A published resource must not lose its publication identity through an
-- automatic FK nulling operation that would contradict the state constraint.
alter table public.learning_resources
  drop constraint if exists learning_resources_course_publication_id_fkey;

alter table public.learning_resources
  add constraint learning_resources_course_publication_id_fkey
  foreign key (course_publication_id)
  references public.course_publications(id)
  on delete restrict;
