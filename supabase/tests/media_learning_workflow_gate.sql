-- Run only against a disposable Supabase database after every migration.
-- Proves required-media publication, calendar metadata, activity-derived
-- completion, privacy boundaries, and replacement-safe progress history.

begin;
set local statement_timeout='45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('26000000-0000-4000-8000-000000000001','authenticated','authenticated','media-learning-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Learning Professor"}',now(),now()),
  ('26000000-0000-4000-8000-000000000002','authenticated','authenticated','media-learning-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Learning Student"}',now(),now()),
  ('26000000-0000-4000-8000-000000000003','authenticated','authenticated','media-learning-outsider@safety.invalid','not-a-login',now(),'{}','{"full_name":"Media Learning Outsider"}',now(),now());

update public.profiles set role='professor'
where id='26000000-0000-4000-8000-000000000001';

insert into public.courses (
  id,owner_id,title,course_code,status,education_division,access_scope
) values (
  '26000000-0000-4000-8000-000000000010',
  '26000000-0000-4000-8000-000000000001',
  'Digital Literacy Media Learning','DLIT 1101','draft','university','independent'
);

insert into public.course_memberships (course_id,user_id,role) values
  ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000002','learner');

select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);
set local role authenticated;

insert into public.assignments (
  id,course_id,professor_id,title,instructions,due_at,status
) values (
  '26000000-0000-4000-8000-000000000015',
  '26000000-0000-4000-8000-000000000010',
  '26000000-0000-4000-8000-000000000001',
  'Recommendation reflection','Submit a short reflection after the media.',
  '2026-08-22T22:00:00Z','published'
);

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,metadata,
  caption_mode,caption_language,accessibility_notes,learning_requirement,
  completion_rule,completion_target_key,learning_due_at,estimated_minutes
) values
  (
    '26000000-0000-4000-8000-000000000020',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    'youtube','Required lesson media','Complete the lesson after viewing.',
    'lesson','external','https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'course','lesson','lesson-media-learning','not_applicable','{"position":1}'::jsonb,
    'provider_captions','en','Professor verified English captions.',
    'required','lesson','lesson-media-learning','2026-08-20T22:00:00Z',15
  ),
  (
    '26000000-0000-4000-8000-000000000021',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    'youtube','Required knowledge-check media','Submit the linked check after viewing.',
    'lesson','external','https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'course','lesson','lesson-media-learning','not_applicable','{"position":2}'::jsonb,
    'provider_captions','en','Professor verified English captions.',
    'required','knowledge_check','check-media-learning','2026-08-21T22:00:00Z',18
  ),
  (
    '26000000-0000-4000-8000-000000000022',
    '26000000-0000-4000-8000-000000000001',
    '26000000-0000-4000-8000-000000000010',
    'youtube','Required assignment media','Submit the linked assignment after viewing.',
    'assignment','external','https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'course','assignment','26000000-0000-4000-8000-000000000015','not_applicable','{"position":3}'::jsonb,
    'provider_captions','en','Professor verified English captions.',
    'required','assignment','26000000-0000-4000-8000-000000000015','2026-08-22T22:00:00Z',20
  );

select id,current_version,status
from public.publish_course_package(
  '26000000-0000-4000-8000-000000000010',
  '{
    "format":"EdNotebookCourse/1.0",
    "course":{"title":"Digital Literacy Media Learning","subtitle":"Linked media","description":"Required media uses real learning completion."},
    "template":{"family":"Digital Literacy"},
    "preset":{"id":"ednotebook-default","version":"1.0"},
    "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
    "paths":[{
      "id":"path-media-learning","label":"Digital Literacy","description":"Media learning path",
      "groups":[{"id":"group-media-learning","title":"Media","nodeIds":["lesson-media-learning"]}],
      "nodes":[{
        "id":"lesson-media-learning","title":"Evaluate recommendation media",
        "knowledgeChecks":[{
          "id":"check-media-learning","question":"What should complete required media?",
          "type":"multiple_choice","options":["The linked learning activity","Playback percentage"],
          "correctAnswer":"The linked learning activity","explanation":"Playback is not learning proof."
        }],
        "endQuiz":[]
      }]
    }]
  }'::jsonb,
  'full_course','ednotebook-default','auto','Required media workflow version one'
);

reset role;
select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
declare
  v_publication_id uuid;
  v_knowledge_snapshot uuid;
  v_envelope jsonb;
begin
  select id into v_publication_id from public.course_publications
  where course_id='26000000-0000-4000-8000-000000000010';
  v_envelope:=public.get_published_course_resources(v_publication_id);
  select (resource->>'id')::uuid into v_knowledge_snapshot
  from jsonb_array_elements(v_envelope->'resources') resource
  where resource->>'resource_id'='26000000-0000-4000-8000-000000000021';
  if jsonb_array_length(v_envelope->'resources')<>3
     or (
       select count(*) from jsonb_array_elements(v_envelope->'resources') resource
       where resource->>'learning_requirement'='required'
         and resource->>'learning_due_at' is not null
         and resource->'learning_progress'->>'status'='pending'
     )<>3
     or v_envelope->'reader_policy'->>'playbackCompletesLearning'<>'false' then
    raise exception 'Published required media did not expose pending linked-learning and due-date state';
  end if;

  perform public.record_course_media_progress(v_knowledge_snapshot,'started',0,100);
  perform public.record_course_media_progress(v_knowledge_snapshot,'completed',100,100);
  v_envelope:=public.get_published_course_resources(v_publication_id);
  if (
    select resource->'learning_progress'->>'status'
    from jsonb_array_elements(v_envelope->'resources') resource
    where resource->>'resource_id'='26000000-0000-4000-8000-000000000021'
  )<>'pending' then
    raise exception 'Playback incorrectly completed a required learning step';
  end if;

  begin
    perform 1 from public.media_learning_progress limit 1;
    raise exception 'Learner bypassed the governed media-learning API';
  exception when insufficient_privilege then null;
  end;

  perform public.save_course_lesson_progress(
    v_publication_id,'path-media-learning','lesson-media-learning',3,'knowledge',
    '{"knowledgeAnswers":{"check-media-learning":"The linked learning activity"},"knowledgeChecked":{"check-media-learning":true},"knowledgeAttempts":{"check-media-learning":1},"quizAnswers":{}}'::jsonb,
    false
  );
  v_envelope:=public.get_published_course_resources(v_publication_id);
  if (
    select resource->'learning_progress'->>'status'
    from jsonb_array_elements(v_envelope->'resources') resource
    where resource->>'resource_id'='26000000-0000-4000-8000-000000000021'
  )<>'completed' or (
    select resource->'learning_progress'->>'status'
    from jsonb_array_elements(v_envelope->'resources') resource
    where resource->>'resource_id'='26000000-0000-4000-8000-000000000020'
  )<>'pending' then
    raise exception 'Knowledge-check completion was not isolated to its exact required media';
  end if;

  perform public.save_course_lesson_progress(
    v_publication_id,'path-media-learning','lesson-media-learning',5,'complete',
    '{"knowledgeAnswers":{"check-media-learning":"The linked learning activity"},"knowledgeChecked":{"check-media-learning":true},"knowledgeAttempts":{"check-media-learning":1},"quizAnswers":{}}'::jsonb,
    true
  );
end;
$$;

insert into public.assignment_drafts (
  assignment_id,student_id,content,storage_mode,status,submitted_at
) values (
  '26000000-0000-4000-8000-000000000015',
  '26000000-0000-4000-8000-000000000002',
  '{"text":"A submitted reflection."}'::jsonb,'cloud','submitted',now()
);

do $$
declare
  v_publication_id uuid;
  v_envelope jsonb;
begin
  select id into v_publication_id from public.course_publications
  where course_id='26000000-0000-4000-8000-000000000010';
  v_envelope:=public.get_published_course_resources(v_publication_id);
  if (
    select count(*)
    from jsonb_array_elements(v_envelope->'resources') resource
    where resource->'learning_progress'->>'status'='completed'
  )<>3 then
    raise exception 'Lesson, knowledge-check, and assignment completion did not converge';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
declare v_publication_id uuid;
begin
  select id into v_publication_id from public.course_publications
  where course_id='26000000-0000-4000-8000-000000000010';
  begin
    perform public.get_published_course_resources(v_publication_id);
    raise exception 'Outsider opened restricted required media';
  exception when others then
    if sqlerrm='Outsider opened restricted required media' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare v_evidence jsonb;
begin
  v_evidence:=public.get_course_media_evidence('26000000-0000-4000-8000-000000000010');
  if v_evidence->>'eligible_learners'<>'1'
     or v_evidence->>'required_resources'<>'3'
     or (
       select count(*) from jsonb_array_elements(v_evidence->'resources') resource
       where resource->>'learning_requirement'='required'
         and resource->>'learning_completed_learners'='1'
         and resource->>'accessibility_status'='ready'
     )<>3
     or v_evidence->'evidence_policy'->>'playbackProvesLearning'<>'false' then
    raise exception 'Professor aggregate linked-learning or accessibility evidence is incomplete';
  end if;
end;
$$;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,metadata,
  caption_mode,caption_language,accessibility_notes,learning_requirement,
  completion_rule,completion_target_key,learning_due_at,estimated_minutes,
  supersedes_resource_id,replacement_note
) values (
  '26000000-0000-4000-8000-000000000023',
  '26000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000010',
  'youtube','Replacement knowledge-check media','Shorter replacement with the same learning target.',
  'lesson','external','https://www.youtube.com/watch?v=ysz5S6PUM-U',
  'course','lesson','lesson-media-learning','not_applicable','{"position":2}'::jsonb,
  'provider_captions','en','Professor verified English captions.',
  'required','knowledge_check','check-media-learning','2026-08-21T22:00:00Z',12,
  '26000000-0000-4000-8000-000000000021','Shorter replacement with the same reviewed learning purpose.'
);

select id,current_version,status
from public.publish_course_package(
  '26000000-0000-4000-8000-000000000010',
  '{
    "format":"EdNotebookCourse/1.0",
    "course":{"title":"Digital Literacy Media Learning","subtitle":"Linked media","description":"Required media uses real learning completion."},
    "template":{"family":"Digital Literacy"},
    "preset":{"id":"ednotebook-default","version":"1.0"},
    "grading":{"mode":"auto","title":"Course completion","maxPoints":100,"dueAt":""},
    "paths":[{"id":"path-media-learning","label":"Digital Literacy","description":"Media learning path","groups":[{"id":"group-media-learning","title":"Media","nodeIds":["lesson-media-learning"]}],"nodes":[{"id":"lesson-media-learning","title":"Evaluate recommendation media","knowledgeChecks":[{"id":"check-media-learning","question":"What should complete required media?","type":"multiple_choice","options":["The linked learning activity","Playback percentage"],"correctAnswer":"The linked learning activity","explanation":"Playback is not learning proof."}],"endQuiz":[]}]}]
  }'::jsonb,
  'full_course','ednotebook-default','auto','Required media replacement version two'
);

reset role;
do $$
begin
  if not exists (
    select 1
    from public.course_publication_resources snapshot
    join public.media_learning_progress progress
      on progress.publication_resource_id=snapshot.id
     and progress.user_id='26000000-0000-4000-8000-000000000002'
    where snapshot.resource_id='26000000-0000-4000-8000-000000000023'
      and snapshot.version_number=2
      and snapshot.learning_requirement='required'
      and progress.status='completed'
      and progress.completion_basis='knowledge_check_submitted'
  ) then
    raise exception 'Replacement media did not inherit the already-completed linked activity';
  end if;
  if not exists (
    select 1
    from public.course_publication_resources snapshot
    join public.media_learning_progress progress on progress.publication_resource_id=snapshot.id
    where snapshot.resource_id='26000000-0000-4000-8000-000000000021'
      and snapshot.version_number=1
      and progress.status='completed'
  ) then
    raise exception 'Publishing replacement media erased original completion history';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);
set local role authenticated;

insert into public.learning_resources (
  id,owner_id,course_id,resource_type,title,description,placement,storage_mode,
  external_url,visibility,target_kind,target_key,security_status,caption_mode,
  caption_language,accessibility_notes,learning_requirement,completion_rule,
  completion_target_key,estimated_minutes
) values (
  '26000000-0000-4000-8000-000000000024',
  '26000000-0000-4000-8000-000000000001',
  '26000000-0000-4000-8000-000000000010',
  'youtube','Invalid required media','Targets a missing check.',
  'lesson','external','https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'course','lesson','lesson-media-learning','not_applicable','provider_captions',
  'en','Professor verified English captions.','required','knowledge_check',
  'missing-check',15
);

do $$
begin
  begin
    perform public.publish_course_package(
      '26000000-0000-4000-8000-000000000010',
      '{"format":"EdNotebookCourse/1.0","course":{"title":"Digital Literacy Media Learning"},"template":{"family":"Digital Literacy"},"preset":{"id":"ednotebook-default"},"grading":{"mode":"auto","maxPoints":100,"dueAt":""},"paths":[{"id":"path-media-learning","label":"Digital Literacy","groups":[{"id":"group-media-learning","title":"Media","nodeIds":["lesson-media-learning"]}],"nodes":[{"id":"lesson-media-learning","title":"Evaluate recommendation media","knowledgeChecks":[{"id":"check-media-learning","question":"What should complete required media?","options":["The linked learning activity"],"correctAnswer":"The linked learning activity"}],"endQuiz":[]}]}]}'::jsonb,
      'full_course','ednotebook-default','auto','Must fail missing knowledge check'
    );
    raise exception 'Publication accepted required media with a missing knowledge-check target';
  exception when others then
    if sqlerrm='Publication accepted required media with a missing knowledge-check target' then raise; end if;
  end;
end;
$$;

rollback;
