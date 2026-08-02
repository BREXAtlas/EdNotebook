-- Run only against a disposable Supabase database after every migration.
-- Proves course/book catalog separation, free access, assigned-book scoping,
-- reading modes, and the fail-closed commercial checkout gate.

begin;
set local statement_timeout = '45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('21000000-0000-4000-8000-000000000001','authenticated','authenticated','library-gate-professor@safety.invalid','not-a-login','{}','{"full_name":"Library Gate Professor","requested_role":"institution_applicant"}',now(),now()),
  ('21000000-0000-4000-8000-000000000002','authenticated','authenticated','library-gate-student@safety.invalid','not-a-login','{}','{"full_name":"Library Gate Student","requested_role":"institution_applicant"}',now(),now()),
  ('21000000-0000-4000-8000-000000000003','authenticated','authenticated','library-gate-outsider@safety.invalid','not-a-login','{}','{"full_name":"Library Gate Outsider","requested_role":"institution_applicant"}',now(),now());

update public.profiles
set role='professor'
where id='21000000-0000-4000-8000-000000000001';

insert into public.courses (
  id,owner_id,title,course_code,status,education_division,access_scope
) values
  (
    '21000000-0000-4000-8000-000000000010',
    '21000000-0000-4000-8000-000000000001',
    'Digital Literacy Library Gate',
    'LIB 1000',
    'published',
    'university',
    'public_free'
  ),
  (
    '21000000-0000-4000-8000-000000000012',
    '21000000-0000-4000-8000-000000000003',
    'Unrelated Course',
    'OTHER 1000',
    'published',
    'university',
    'independent'
  );

insert into public.course_publications (
  id,course_id,created_by,current_version,status,draft_manifest,published_at
) values (
  '21000000-0000-4000-8000-000000000011',
  '21000000-0000-4000-8000-000000000010',
  '21000000-0000-4000-8000-000000000001',
  1,
  'published',
  '{"format":"EdNotebookCourse/1.0","course":{"title":"Digital Literacy Library Gate"},"paths":[]}'::jsonb,
  now()
);

insert into public.published_course_directory (
  course_id,professor_id,institution_name,professor_display_name,course_code,
  title,summary,enrollment_open,is_listed,published_at,education_division,
  enrollment_policy,universal_assignment,completion_badge_name,
  completion_badge_description
) values (
  '21000000-0000-4000-8000-000000000010',
  '21000000-0000-4000-8000-000000000001',
  'Independent course',
  'Library Gate Professor',
  'LIB 1000',
  'Digital Literacy Library Gate',
  'A free governed Library example.',
  true,
  true,
  now(),
  'university',
  'open_self_enroll',
  false,
  'Digital Literacy Library Complete',
  'Recognizes completion of the Digital Literacy Library Gate course.'
);

select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select course_id,library_access_model,library_listing_status
from public.set_course_library_listing(
  '21000000-0000-4000-8000-000000000010',
  'open_free',
  null,
  null
);

reset role;
do $$
begin
  if not exists (
    select 1 from public.published_course_directory
    where course_id='21000000-0000-4000-8000-000000000010'
      and library_access_model='open_free'
      and library_listing_status='published'
      and universal_assignment=false
  ) then
    raise exception 'Free Library listing changed or lost its separate universal-assignment state';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
  if not exists (
    select 1 from public.list_alex_morrison_catalog('Digital Literacy')
    where item_kind='course'
      and item_id='21000000-0000-4000-8000-000000000010'
      and access_model='open_free'
      and checkout_available=false
  ) then
    raise exception 'Anonymous Library search did not return the safe free-course preview';
  end if;
end;
$$;

reset role;
insert into public.publications (
  id,owner_id,title,author_name,description,rights_confirmed,rights_statement,
  conversion_status,edubook_manifest,access_model,status,reading_mode
) values (
  '21000000-0000-4000-8000-000000000020',
  '21000000-0000-4000-8000-000000000001',
  'Professor Authored Library Gate Book',
  'Library Gate Professor',
  'One source record for read-only, interactive, assigned, or open placement.',
  true,
  'Professor owns this gate fixture.',
  'ready',
  '{"format":"EduBook/1.0","chapters":[{"id":"one","title":"One","blocks":[],"knowledgeChecks":[]}]}'::jsonb,
  'private',
  'draft',
  'interactive'
);

select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,course_id,access_model,reading_mode,status
from public.set_publication_library_access(
  '21000000-0000-4000-8000-000000000020',
  'assigned',
  'interactive',
  '21000000-0000-4000-8000-000000000010',
  null,
  null
);

reset role;
insert into public.course_memberships (course_id,user_id,role)
values (
  '21000000-0000-4000-8000-000000000010',
  '21000000-0000-4000-8000-000000000002',
  'learner'
);

select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.publications
    where id='21000000-0000-4000-8000-000000000020'
      and access_model='assigned'
      and reading_mode='interactive'
  ) then
    raise exception 'Enrolled student could not open the assigned interactive book';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.publications
    where id='21000000-0000-4000-8000-000000000020'
  ) then
    raise exception 'Assigned book leaked to a student outside the linked course';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,access_model,reading_mode,status
from public.set_publication_library_access(
  '21000000-0000-4000-8000-000000000020',
  'open',
  'read_only',
  null,
  null,
  null
);

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.publications
    where id='21000000-0000-4000-8000-000000000020'
      and access_model='open'
      and reading_mode='read_only'
  ) then
    raise exception 'Open read-only book was not available to a signed-in student';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select id,access_model,status,price_cents
from public.set_publication_library_access(
  '21000000-0000-4000-8000-000000000020',
  'purchase',
  'interactive',
  null,
  1299,
  null
);

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.publications
    where id='21000000-0000-4000-8000-000000000020'
  ) then
    raise exception 'Commercial review record granted book-content access without an entitlement';
  end if;
  if exists (
    select 1 from public.list_alex_morrison_catalog('Professor Authored')
    where item_kind='book'
      and item_id='21000000-0000-4000-8000-000000000020'
      and listing_status='review'
  ) then
    raise exception 'Commercial review metadata leaked to another signed-in account';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
begin
  if not exists (
    select 1 from public.list_alex_morrison_catalog('Professor Authored')
    where item_kind='book'
      and item_id='21000000-0000-4000-8000-000000000020'
      and listing_status='review'
      and price_cents=1299
      and checkout_available=false
  ) then
    raise exception 'Commercial review preview was missing for its owner or claimed checkout availability';
  end if;
end;
$$;

do $$
begin
  update public.publications
  set status='published'
  where id='21000000-0000-4000-8000-000000000020';
  raise exception 'Expected direct commercial publication release to fail';
exception
  when others then
    if sqlerrm not like '%Commercial publication governance is not approved%' then
      raise;
    end if;
end;
$$;

do $$
begin
  update public.publications
  set access_model='assigned',
      status='published',
      course_id='21000000-0000-4000-8000-000000000012',
      price_cents=null
  where id='21000000-0000-4000-8000-000000000020';
  raise exception 'Expected a foreign-course publication link to fail';
exception
  when others then
    if sqlerrm not like '%row-level security%' then
      raise;
    end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','',true);
rollback;
