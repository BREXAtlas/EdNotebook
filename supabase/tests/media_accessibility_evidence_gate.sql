-- Run only against a disposable Supabase database after every migration.
-- Proves accessible publication, immutable replacement lineage, version-bound
-- viewing evidence, aggregate professor reporting, and fail-closed access.

begin;
set local statement_timeout='45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('25000000-0000-4000-8000-000000000001','authenticated','authenticated','accessible-media-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Accessible Media Professor"}',now(),now()),
  ('25000000-0000-4000-8000-000000000002','authenticated','authenticated','accessible-media-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Accessible Media Student"}',now(),now()),
  ('25000000-0000-4000-8000-000000000003','authenticated','authenticated','accessible-media-outsider@safety.invalid','not-a-login',now(),'{}','{"full_name":"Accessible Media Outsider"}',now(),now());

update public.profiles set role='professor'
where id='25000000-0000-4000-8000-000000000001';

insert into public.courses (
  id,owner_id,title,course_code,status,education_division,access_scope
) values (
  '25000000-0000-4000-8000-000000000010',
  '25000000-0000-4000-8000-000000000001',
  'Accessible Digital Literacy Media','DLIT 1001','draft','university','independent'
);

insert into public.course_memberships (course_id,user_id,role) values
  ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000002','learner');

select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000001',true);
set local role authenticated;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,metadata,
  caption_mode,caption_language,accessibility_notes
) values (
  '25000000-0000-4000-8000-000000000020',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000010',
  'youtube','Recommendation systems with verified captions',
  'Watch with captions and compare two recommendation signals.',
  'lesson','external','https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'course','lesson','lesson-accessible-media','not_applicable',
  '{"format":"EdNotebookCourseResource/2.0","position":1}'::jsonb,
  'provider_captions','en','Professor verified English captions in the source player.'
);

do $$
begin
  if not exists (
    select 1 from public.learning_resources
    where id='25000000-0000-4000-8000-000000000020'
      and resource_family_id=id
      and resource_version=1
      and lifecycle_state='active'
      and accessibility_status='ready'
  ) then raise exception 'Accessible media version one was not governed correctly'; end if;
end;
$$;

select id,current_version,status
from public.publish_course_package(
  '25000000-0000-4000-8000-000000000010',
  '{
    "format":"EdNotebookCourse/1.0",
    "course":{"title":"Accessible Digital Literacy Media","subtitle":"Accessible media","description":"A controlled accessibility fixture."},
    "template":{"family":"Digital Literacy"},
    "preset":{"id":"ednotebook-default","version":"1.0"},
    "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
    "paths":[{
      "id":"path-accessible-media","label":"Digital Literacy","description":"Accessible media path",
      "groups":[{"id":"group-accessible-media","title":"Media","nodeIds":["lesson-accessible-media"]}],
      "nodes":[{"id":"lesson-accessible-media","title":"Evaluate accessible media","knowledgeChecks":[],"endQuiz":[]}]
    }]
  }'::jsonb,
  'full_course','ednotebook-default','auto','Accessible media version one'
);

reset role;
select set_config(
  'app.media_test_snapshot_id',
  (
    select snapshot.id::text
    from public.course_publication_resources snapshot
    join public.course_publications publication on publication.id=snapshot.publication_id
    where publication.course_id='25000000-0000-4000-8000-000000000010'
      and snapshot.version_number=1
  ),
  true
);
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
declare
  v_publication_id uuid;
  v_snapshot_id uuid;
  v_result jsonb;
begin
  select id into v_publication_id from public.course_publications
  where course_id='25000000-0000-4000-8000-000000000010';
  v_snapshot_id:=current_setting('app.media_test_snapshot_id')::uuid;

  v_result:=public.record_course_media_progress(v_snapshot_id,'started',0,100);
  v_result:=public.record_course_media_progress(v_snapshot_id,'progress',40,100);
  v_result:=public.record_course_media_progress(v_snapshot_id,'captions_enabled',40,100);
  v_result:=public.record_course_media_progress(v_snapshot_id,'transcript_opened',40,100);
  v_result:=public.record_course_media_progress(v_snapshot_id,'completed',100,100);

  if v_result->'progress'->>'status'<>'completed'
     or (v_result->'progress'->>'percent_complete')::numeric<>100
     or v_result->'progress'->>'captions_enabled'<>'true'
     or v_result->'progress'->>'transcript_opened'<>'true'
     or v_result->'evidence_policy'->>'provesLearning'<>'false' then
    raise exception 'Learner media progress was not summarized correctly';
  end if;

  begin
    perform 1 from public.media_viewing_progress limit 1;
    raise exception 'Learner bypassed the governed progress RPC';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.get_course_media_evidence('25000000-0000-4000-8000-000000000010');
    raise exception 'Learner opened professor media evidence';
  exception when others then
    if sqlerrm='Learner opened professor media evidence' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
declare v_snapshot_id uuid;
begin
  v_snapshot_id:=current_setting('app.media_test_snapshot_id')::uuid;
  begin
    perform public.record_course_media_progress(v_snapshot_id,'started',0,100);
    raise exception 'Outsider recorded viewing evidence for a restricted course';
  exception when others then
    if sqlerrm='Outsider recorded viewing evidence for a restricted course' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare evidence jsonb;
begin
  evidence:=public.get_course_media_evidence('25000000-0000-4000-8000-000000000010');
  if evidence->>'eligible_learners'<>'1'
     or evidence->'resources'->0->>'started_learners'<>'1'
     or evidence->'resources'->0->>'completed_learners'<>'1'
     or evidence->'resources'->0->>'caption_learners'<>'1'
     or evidence->'resources'->0->>'transcript_learners'<>'1'
     or evidence->'evidence_policy'->>'individualPlaybackLogExposed'<>'false' then
    raise exception 'Professor aggregate viewing evidence is incomplete';
  end if;
  begin
    perform public.record_course_media_progress(
      current_setting('app.media_test_snapshot_id')::uuid,'started',0,100
    );
    raise exception 'Professor preview activity entered learner viewing evidence';
  exception when others then
    if sqlerrm='Professor preview activity entered learner viewing evidence' then raise; end if;
  end;
end;
$$;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,metadata,
  supersedes_resource_id,replacement_note,caption_mode,caption_language,
  transcript_text,accessibility_notes
) values (
  '25000000-0000-4000-8000-000000000021',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000010',
  'youtube','Recommendation systems with EdNotebook transcript',
  'Replacement video with a reviewed transcript.',
  'lesson','external','https://www.youtube.com/watch?v=M7lc1UVf-VE',
  'course','lesson','lesson-accessible-media','not_applicable',
  '{"format":"EdNotebookCourseResource/2.0","position":1}'::jsonb,
  '25000000-0000-4000-8000-000000000020',
  'Replaced with a shorter, clearer explanation.',
  'transcript','en',
  'This reviewed transcript explains how behavior and context influence recommendations.',
  'The transcript is available directly below the in-platform player.'
);

do $$
begin
  if not exists (
    select 1
    from public.learning_resources previous
    join public.learning_resources replacement
      on replacement.supersedes_resource_id=previous.id
     and replacement.resource_family_id=previous.resource_family_id
    where previous.id='25000000-0000-4000-8000-000000000020'
      and previous.lifecycle_state='replaced'
      and replacement.id='25000000-0000-4000-8000-000000000021'
      and replacement.resource_version=2
      and replacement.lifecycle_state='active'
      and replacement.accessibility_status='ready'
  ) then raise exception 'Replacement media lineage was not preserved'; end if;
end;
$$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.course_publication_resources
    where resource_id='25000000-0000-4000-8000-000000000020'
      and version_number=1
  ) then raise exception 'Replacing a draft resource rewrote the published version-one snapshot'; end if;
end;
$$;
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000001',true);
set local role authenticated;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status
) values (
  '25000000-0000-4000-8000-000000000022',
  '25000000-0000-4000-8000-000000000001',
  '25000000-0000-4000-8000-000000000010',
  'youtube','Unreviewed media must fail closed','No caption decision yet.',
  'course-library','external','https://youtu.be/dQw4w9WgXcQ',
  'course','course',null,'not_applicable'
);

do $$
begin
  begin
    perform public.publish_course_package(
      '25000000-0000-4000-8000-000000000010',
      '{
        "format":"EdNotebookCourse/1.0",
        "course":{"title":"Accessible Digital Literacy Media","subtitle":"Accessible media","description":"A controlled accessibility fixture."},
        "template":{"family":"Digital Literacy"},
        "preset":{"id":"ednotebook-default","version":"1.0"},
        "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
        "paths":[{"id":"path-accessible-media","label":"Digital Literacy","description":"Accessible media path","groups":[{"id":"group-accessible-media","title":"Media","nodeIds":["lesson-accessible-media"]}],"nodes":[{"id":"lesson-accessible-media","title":"Evaluate accessible media","knowledgeChecks":[],"endQuiz":[]}]}]
      }'::jsonb,
      'full_course','ednotebook-default','auto','Must fail accessibility review'
    );
    raise exception 'Course publication accepted media needing accessibility review';
  exception when others then
    if sqlerrm='Course publication accepted media needing accessibility review' then raise; end if;
  end;
end;
$$;

select public.retire_learning_resource(
  '25000000-0000-4000-8000-000000000022',
  'Removed because accessibility review was incomplete.'
);

select id,current_version,status
from public.publish_course_package(
  '25000000-0000-4000-8000-000000000010',
  '{
    "format":"EdNotebookCourse/1.0",
    "course":{"title":"Accessible Digital Literacy Media","subtitle":"Accessible media","description":"A controlled accessibility fixture."},
    "template":{"family":"Digital Literacy"},
    "preset":{"id":"ednotebook-default","version":"1.0"},
    "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
    "paths":[{
      "id":"path-accessible-media","label":"Digital Literacy","description":"Accessible media path",
      "groups":[{"id":"group-accessible-media","title":"Media","nodeIds":["lesson-accessible-media"]}],
      "nodes":[{"id":"lesson-accessible-media","title":"Evaluate accessible media","knowledgeChecks":[],"endQuiz":[]}]
    }]
  }'::jsonb,
  'full_course','ednotebook-default','auto','Accessible replacement media version two'
);

reset role;
do $$
begin
  if not exists (
    select 1 from public.course_publication_resources
    where resource_id='25000000-0000-4000-8000-000000000021'
      and version_number=2
      and resource_version=2
      and caption_mode='transcript'
      and transcript_text like 'This reviewed transcript%'
      and accessibility_status='ready'
  ) then raise exception 'Version-two snapshot did not preserve transcript and replacement identity'; end if;
  if exists (
    select 1 from public.course_publication_resources
    where resource_id='25000000-0000-4000-8000-000000000020'
      and version_number=2
  ) then raise exception 'Replaced media leaked into publication version two'; end if;
  if not exists (
    select 1 from public.media_viewing_progress
    where user_id='25000000-0000-4000-8000-000000000002'
      and version_number=1
      and status='completed'
  ) then raise exception 'Publishing a replacement erased historical viewing evidence'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
declare v_old_snapshot_id uuid;
begin
  v_old_snapshot_id:=current_setting('app.media_test_snapshot_id')::uuid;
  begin
    perform public.record_course_media_progress(v_old_snapshot_id,'progress',50,100);
    raise exception 'Learner changed evidence for a superseded publication version';
  exception when others then
    if sqlerrm='Learner changed evidence for a superseded publication version' then raise; end if;
  end;
end;
$$;

rollback;
