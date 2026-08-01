-- Run only against a disposable Supabase database after every migration.
-- Proves immutable professor publication, in-platform YouTube playback data,
-- exact lesson targeting, private learner resources, and fail-closed sharing.

begin;
set local statement_timeout='45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('24000000-0000-4000-8000-000000000001','authenticated','authenticated','media-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Professor"}',now(),now()),
  ('24000000-0000-4000-8000-000000000002','authenticated','authenticated','media-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Student"}',now(),now()),
  ('24000000-0000-4000-8000-000000000003','authenticated','authenticated','media-outsider@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Outsider"}',now(),now());

update public.profiles set role='professor'
where id='24000000-0000-4000-8000-000000000001';

insert into public.courses (
  id,owner_id,title,course_code,status,education_division,access_scope
) values (
  '24000000-0000-4000-8000-000000000010',
  '24000000-0000-4000-8000-000000000001',
  'Digital Literacy Media Gate','DLIT 1000','draft','university','independent'
);

insert into public.course_memberships (course_id,user_id,role) values
  ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000002','learner');

select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',true);
set local role authenticated;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,metadata
) values (
  '24000000-0000-4000-8000-000000000020',
  '24000000-0000-4000-8000-000000000001',
  '24000000-0000-4000-8000-000000000010',
  'youtube','How recommendation systems shape attention',
  'Watch here, then identify one signal that changes a recommendation.',
  'lesson','external','https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'course','lesson','lesson-media','not_applicable',
  '{"format":"EdNotebookCourseResource/1.0","position":1}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.learning_resources
    where id='24000000-0000-4000-8000-000000000020'
      and course_publication_state='draft'
  ) then raise exception 'Professor media did not begin as an unpublished draft'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.learning_resources
    where id='24000000-0000-4000-8000-000000000020'
  ) then raise exception 'Learner saw professor media before course publication'; end if;
  begin
    insert into public.learning_resources (
      owner_id,course_id,resource_type,title,description,placement,storage_mode,
      external_url,visibility,target_kind,target_key,security_status
    ) values (
      '24000000-0000-4000-8000-000000000002',
      '24000000-0000-4000-8000-000000000010',
      'youtube','Student tried to publish','Must remain private','lesson','external',
      'https://youtu.be/dQw4w9WgXcQ','course','lesson','lesson-media','not_applicable'
    );
    raise exception 'Learner published media to classmates without professor control';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select public.save_my_course_link(
  '24000000-0000-4000-8000-000000000010',
  'https://youtu.be/dQw4w9WgXcQ?t=8',
  'My private Digital Literacy example',
  'A personal reminder for this lesson.'
);

do $$
declare personal jsonb;
begin
  personal:=public.get_my_course_resources('24000000-0000-4000-8000-000000000010');
  if jsonb_array_length(personal)<>1
     or personal->0->>'embed_provider'<>'youtube'
     or personal->0->>'embed_key'<>'dQw4w9WgXcQ' then
    raise exception 'Private learner YouTube resource was not saved correctly';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
begin
  if exists (
    select 1 from public.learning_resources
    where owner_id='24000000-0000-4000-8000-000000000002'
      and target_kind='personal'
  ) then raise exception 'Professor saw a learner private resource'; end if;
end;
$$;

select id,current_version,status
from public.publish_course_package(
  '24000000-0000-4000-8000-000000000010',
  '{
    "format":"EdNotebookCourse/1.0",
    "course":{"title":"Digital Literacy Media Gate","subtitle":"Learn inside EdNotebook","description":"A controlled media fixture."},
    "template":{"family":"Digital Literacy"},
    "preset":{"id":"ednotebook-default","version":"1.0"},
    "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
    "paths":[{
      "id":"path-media","label":"Digital Literacy","description":"Media path",
      "groups":[{"id":"group-media","title":"Media","nodeIds":["lesson-media"]}],
      "nodes":[{"id":"lesson-media","title":"Evaluate embedded media","knowledgeChecks":[],"endQuiz":[]}]
    }]
  }'::jsonb,
  'full_course','ednotebook-default','auto','Initial controlled media publication'
);

reset role;
do $$
begin
  if not exists (
    select 1 from public.learning_resources
    where id='24000000-0000-4000-8000-000000000020'
      and course_publication_state='published'
      and course_publication_version=1
  ) then raise exception 'Published professor resource did not record its course version'; end if;
  if not exists (
    select 1 from public.course_publication_resources snapshot
    where snapshot.resource_id='24000000-0000-4000-8000-000000000020'
      and snapshot.version_number=1
      and snapshot.target_kind='lesson'
      and snapshot.target_key='lesson-media'
      and snapshot.embed_provider='youtube'
      and snapshot.embed_key='dQw4w9WgXcQ'
  ) then raise exception 'Versioned in-platform media snapshot is incomplete'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
declare publication_id uuid;
  envelope jsonb;
begin
  select id into publication_id from public.course_publications
  where course_id='24000000-0000-4000-8000-000000000010';
  envelope:=public.get_published_course_resources(publication_id);
  if envelope->>'version_number'<>'1'
     or envelope->'reader_policy'->>'youtubeHost'<>'https://www.youtube-nocookie.com'
     or envelope->'resources'->0->>'embed_key'<>'dQw4w9WgXcQ' then
    raise exception 'Learner reader did not receive the governed version-one media';
  end if;
  begin
    perform 1 from public.course_publication_resources limit 1;
    raise exception 'Browser bypassed the governed media RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare publication_id uuid;
begin
  select id into publication_id from public.course_publications
  where course_id='24000000-0000-4000-8000-000000000010';
  begin
    perform public.get_published_course_resources(publication_id);
    raise exception 'Outsider opened course media without course access';
  exception when others then
    if sqlerrm='Outsider opened course media without course access' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000001',true);
set local role authenticated;
update public.learning_resources
set external_url='https://youtu.be/M7lc1UVf-VE',title='Updated recommendation systems video'
where id='24000000-0000-4000-8000-000000000020';

do $$
begin
  if not exists (
    select 1 from public.learning_resources
    where id='24000000-0000-4000-8000-000000000020'
      and course_publication_state='draft'
  ) then raise exception 'Professor edit did not return media to draft'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare publication_id uuid;
  envelope jsonb;
begin
  select id into publication_id from public.course_publications
  where course_id='24000000-0000-4000-8000-000000000010';
  envelope:=public.get_published_course_resources(publication_id);
  if envelope->'resources'->0->>'embed_key'<>'dQw4w9WgXcQ' then
    raise exception 'An unpublished professor edit changed the live learner snapshot';
  end if;
end;
$$;

rollback;
