-- Run only against a disposable Supabase database after every migration.
-- Proves versioned professor teaching layers, hidden answer keys, persistent
-- learner progress, completion scoring, and publication-scoped annotations.

begin;
set local statement_timeout='45s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('23000000-0000-4000-8000-000000000001','authenticated','authenticated','edubook-professor@safety.invalid','not-a-login',now(),'{}','{"full_name":"EduBook Professor"}',now(),now()),
  ('23000000-0000-4000-8000-000000000002','authenticated','authenticated','edubook-student@safety.invalid','not-a-login',now(),'{}','{"full_name":"EduBook Student"}',now(),now()),
  ('23000000-0000-4000-8000-000000000003','authenticated','authenticated','edubook-outsider@safety.invalid','not-a-login',now(),'{}','{"full_name":"EduBook Outsider"}',now(),now());

update public.profiles set role='professor'
where id='23000000-0000-4000-8000-000000000001';

insert into public.publications (
  id,owner_id,title,author_name,description,rights_confirmed,rights_statement,
  conversion_status,edubook_manifest,access_model,status,reading_mode
) values
  (
    '23000000-0000-4000-8000-000000000010',
    '23000000-0000-4000-8000-000000000001',
    'Digital Literacy Interactive Reading',
    'EduBook Professor',
    'An interactive Digital Literacy book used by the controlled gate.',
    true,
    'The fixture professor owns this original educational publication.',
    'ready',
    '{"format":"EduBook/1.0","chapters":[{"id":"source-one","title":"Verify","blocks":[{"id":"p-one","type":"paragraph","text":"Verify a source before sharing it."}]},{"id":"source-two","title":"Reflect","blocks":[{"id":"p-two","type":"paragraph","text":"Reflect on the evidence."}]}],"learningLayer":{"schemaVersion":"EduBookLearning/1.0","chapters":[],"finalQuiz":[]}}'::jsonb,
    'open','published','interactive'
  ),
  (
    '23000000-0000-4000-8000-000000000011',
    '23000000-0000-4000-8000-000000000001',
    'Private Professor Draft',
    'EduBook Professor',
    'A private publication used to prove annotation scope.',
    true,
    'The fixture professor owns this private draft.',
    'ready',
    '{"format":"EduBook/1.0","chapters":[{"id":"private-one","title":"Private","blocks":[]}]}'::jsonb,
    'private','draft','read_only'
  );

select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;

select id,current_learning_version
from public.save_publication_learning_layer(
  '23000000-0000-4000-8000-000000000010',
  '{
    "schemaVersion":"EduBookLearning/1.0",
    "chapters":[{
      "chapterId":"source-one",
      "knowledgeChecks":[{
        "id":"check-source",
        "prompt":"What should happen before sharing a source?",
        "options":["Verify the evidence","Repeat it immediately"],
        "correctAnswer":"Verify the evidence",
        "explanation":"Verification checks evidence and context."
      }],
      "discussionPrompts":[{
        "id":"discuss-source",
        "prompt":"Describe one signal that makes a source credible."
      }]
    }],
    "finalQuiz":[{
      "id":"quiz-source",
      "prompt":"Which habit supports digital literacy?",
      "options":["Cross-check claims","Trust every post"],
      "correctAnswer":"Cross-check claims",
      "explanation":"Cross-checking reduces unsupported sharing."
    }]
  }'::jsonb,
  'Added a chapter check, reflection, and final quiz.'
);

do $$
declare author_layer jsonb;
begin
  if not exists (
    select 1 from public.publications
    where id='23000000-0000-4000-8000-000000000010'
      and current_learning_version=1
      and edubook_manifest->'chapters'->0->'blocks'->0->>'text'='Verify a source before sharing it.'
      and edubook_manifest::text not like '%correctAnswer%'
      and edubook_manifest::text not like '%Verification checks evidence%'
  ) then raise exception 'Public EduBook manifest leaked an answer key or changed the source'; end if;
  if not exists (
    select 1 from public.publication_learning_versions
    where publication_id='23000000-0000-4000-8000-000000000010'
      and version_number=1
  ) then raise exception 'Teaching-layer version history was not created'; end if;
  author_layer := public.get_publication_learning_layer_for_author('23000000-0000-4000-8000-000000000010');
  if author_layer->'chapters'->0->'knowledgeChecks'->0->>'correctAnswer'<>'Verify the evidence' then
    raise exception 'Publication owner could not recover the private answer key';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000002',true);
set local role authenticated;

do $$
begin
  begin
    insert into public.publication_reading_progress (
      publication_id,user_id,chapter_index,chapter_id
    ) values (
      '23000000-0000-4000-8000-000000000010',
      '23000000-0000-4000-8000-000000000002',0,'source-one'
    );
    raise exception 'Authenticated browser wrote progress without the governed RPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_publication_learning_layer_for_author('23000000-0000-4000-8000-000000000010');
    raise exception 'Student opened the private professor answer key';
  exception when others then
    if sqlerrm='Student opened the private professor answer key' then raise; end if;
  end;
  begin
    perform public.get_publication_reading_progress_summary('23000000-0000-4000-8000-000000000010');
    raise exception 'Student opened the professor progress summary';
  exception when others then
    if sqlerrm='Student opened the professor progress summary' then raise; end if;
  end;
end;
$$;

select id,status,completion_percent
from public.save_publication_reading_progress(
  '23000000-0000-4000-8000-000000000010',
  0,
  'source-one',
  '{"answers":{"check-source":"Verify the evidence"},"discussionResponses":{"discuss-source":"Authority and supporting evidence."}}'::jsonb,
  false
);

do $$
begin
  begin
    perform public.save_publication_reading_progress(
      '23000000-0000-4000-8000-000000000010',
      1,
      'source-two',
      '{"answers":{"check-source":"Verify the evidence"}}'::jsonb,
      true
    );
    raise exception 'Incomplete final quiz was allowed to complete the book';
  exception when others then
    if sqlerrm='Incomplete final quiz was allowed to complete the book' then raise; end if;
  end;
end;
$$;

select id,status,completion_percent,auto_score
from public.save_publication_reading_progress(
  '23000000-0000-4000-8000-000000000010',
  1,
  'source-two',
  '{"answers":{"check-source":"Verify the evidence","quiz-source":"Trust every post"},"discussionResponses":{"discuss-source":"Authority and supporting evidence."}}'::jsonb,
  true
);

insert into public.reading_annotations (
  publication_id,user_id,locator,note,annotation_type
) values (
  '23000000-0000-4000-8000-000000000010',
  '23000000-0000-4000-8000-000000000002',
  'chapter:source-one','My private source-verification note.','note'
);

do $$
begin
  if not exists (
    select 1 from public.publication_reading_progress
    where publication_id='23000000-0000-4000-8000-000000000010'
      and user_id='23000000-0000-4000-8000-000000000002'
      and status='completed'
      and completion_percent=100
      and auto_score=50
      and interaction_state->'discussionResponses'->>'discuss-source'='Authority and supporting evidence.'
  ) then raise exception 'Completed EduBook progress or server score is incorrect'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
begin
  begin
    insert into public.reading_annotations (
      publication_id,user_id,locator,note,annotation_type
    ) values (
      '23000000-0000-4000-8000-000000000011',
      '23000000-0000-4000-8000-000000000003',
      'chapter:private-one','This must not be accepted.','note'
    );
    raise exception 'Outsider annotated a private publication';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_publication_reading_progress(
      '23000000-0000-4000-8000-000000000011',0,'private-one','{}'::jsonb,false
    );
    raise exception 'Outsider saved progress against a private publication';
  exception when others then
    if sqlerrm='Outsider saved progress against a private publication' then raise; end if;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.publication_reading_progress
    where publication_id='23000000-0000-4000-8000-000000000010'
  ) then raise exception 'Standalone commercial/open reader progress leaked to the publication seller'; end if;
  begin
    perform public.get_publication_reading_progress_summary('23000000-0000-4000-8000-000000000010');
    raise exception 'Standalone seller opened the governed progress summary';
  exception when others then
    if sqlerrm='Standalone seller opened the governed progress summary' then raise; end if;
  end;
end;
$$;

rollback;
