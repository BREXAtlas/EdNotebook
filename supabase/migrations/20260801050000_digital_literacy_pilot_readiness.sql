-- Canonical Digital Literacy course assignment, completion, and research-readiness bridge.
-- Course content remains owned by BREXAtlas/Digital-Literacy-Course. This migration
-- stores only a versioned catalog snapshot and governed evidence. It does not
-- activate human-subjects research or treat course enrollment as consent.

create table public.digital_literacy_catalog_releases (
  release_id text primary key check (release_id ~ '^[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]+$'),
  course_key text not null check (course_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  source_repository text not null check (source_repository = 'https://github.com/BREXAtlas/Digital-Literacy-Course'),
  source_home text not null check (source_home = 'https://brexatlas.github.io/Digital-Literacy-Course/'),
  manifest_url text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  unit_count integer not null check (unit_count = 40),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index digital_literacy_catalog_one_active_idx
  on public.digital_literacy_catalog_releases(course_key)
  where active;

create table public.digital_literacy_catalog_units (
  release_id text not null references public.digital_literacy_catalog_releases(release_id) on delete restrict,
  unit_id text not null check (unit_id ~ '^(ep|q)(0[1-9]|1[0-9]|20)$'),
  path text not null check (path in ('foundations','ai-quest')),
  unit_kind text not null check (unit_kind in ('episode','quest')),
  group_number integer not null check (group_number between 1 and 4),
  group_title text not null check (char_length(btrim(group_title)) between 3 and 120),
  position integer not null check (position between 1 and 40),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  relative_url text not null check (
    relative_url ~ '^(foundations\.html\?ep=ep|ai-quest\.html\?q=q)(0[1-9]|1[0-9]|20)&generic=1$'
  ),
  primary key (release_id, unit_id),
  unique (release_id, position),
  check (
    (unit_id like 'ep%' and path='foundations' and unit_kind='episode' and position between 1 and 20)
    or (unit_id like 'q%' and path='ai-quest' and unit_kind='quest' and position between 21 and 40)
  )
);

insert into public.digital_literacy_catalog_releases (
  release_id, course_key, title, source_repository, source_home,
  manifest_url, manifest_sha256, unit_count, active
) values (
  '2026.08.01.1',
  'brexatlas.digital-literacy-course',
  'Ram Ready Digital Literacy',
  'https://github.com/BREXAtlas/Digital-Literacy-Course',
  'https://brexatlas.github.io/Digital-Literacy-Course/',
  'https://brexatlas.github.io/Digital-Literacy-Course/data/ednotebook-course-manifest.json',
  'a742d5d3f662f0c5d16223dc3c8252d2230ccf5e17b770fbb3d938c62072ffd6',
  40,
  true
);

insert into public.digital_literacy_catalog_units (
  release_id, unit_id, path, unit_kind, group_number, group_title, position, title, relative_url
) values
  ('2026.08.01.1','ep01','foundations','episode',1,'Start College Digitally Ready',1,'Build a College File System','foundations.html?ep=ep01&generic=1'),
  ('2026.08.01.1','ep02','foundations','episode',1,'Start College Digitally Ready',2,'Name Files Like a College Student','foundations.html?ep=ep02&generic=1'),
  ('2026.08.01.1','ep03','foundations','episode',1,'Start College Digitally Ready',3,'Control Drafts, Feedback, and Final Versions','foundations.html?ep=ep03&generic=1'),
  ('2026.08.01.1','ep04','foundations','episode',1,'Start College Digitally Ready',4,'Submit, Preview, and Save Proof','foundations.html?ep=ep04&generic=1'),
  ('2026.08.01.1','ep05','foundations','episode',1,'Start College Digitally Ready',5,'Write a Professor-Ready Email','foundations.html?ep=ep05&generic=1'),
  ('2026.08.01.1','ep06','foundations','episode',2,'Communicate and Find Information',6,'Ask for Help While Showing Prior Effort','foundations.html?ep=ep06&generic=1'),
  ('2026.08.01.1','ep07','foundations','episode',2,'Communicate and Find Information',7,'Turn the Syllabus Into a Working Calendar','foundations.html?ep=ep07&generic=1'),
  ('2026.08.01.1','ep08','foundations','episode',2,'Communicate and Find Information',8,'Build a Professional Digital Identity','foundations.html?ep=ep08&generic=1'),
  ('2026.08.01.1','ep09','foundations','episode',2,'Communicate and Find Information',9,'Choose the Right Search Tool','foundations.html?ep=ep09&generic=1'),
  ('2026.08.01.1','ep10','foundations','episode',2,'Communicate and Find Information',10,'Evaluate Authority, Evidence, and Relevance','foundations.html?ep=ep10&generic=1'),
  ('2026.08.01.1','ep11','foundations','episode',3,'Read, Cite, and Protect',11,'Read Academic Sources Without Drowning','foundations.html?ep=ep11&generic=1'),
  ('2026.08.01.1','ep12','foundations','episode',3,'Read, Cite, and Protect',12,'Separate Quotes, Paraphrases, and Original Ideas','foundations.html?ep=ep12&generic=1'),
  ('2026.08.01.1','ep13','foundations','episode',3,'Read, Cite, and Protect',13,'Protect Student Accounts','foundations.html?ep=ep13&generic=1'),
  ('2026.08.01.1','ep14','foundations','episode',3,'Read, Cite, and Protect',14,'Recognize Phishing and Urgency Tricks','foundations.html?ep=ep14&generic=1'),
  ('2026.08.01.1','ep15','foundations','episode',3,'Read, Cite, and Protect',15,'Handle Official Documents Carefully','foundations.html?ep=ep15&generic=1'),
  ('2026.08.01.1','ep16','foundations','episode',4,'Share, Recover, and Succeed',16,'Control Sharing Permissions and Digital Footprints','foundations.html?ep=ep16&generic=1'),
  ('2026.08.01.1','ep17','foundations','episode',4,'Share, Recover, and Succeed',17,'Run a Weekly Digital Reset','foundations.html?ep=ep17&generic=1'),
  ('2026.08.01.1','ep18','foundations','episode',4,'Share, Recover, and Succeed',18,'Use the Final Submission Check','foundations.html?ep=ep18&generic=1'),
  ('2026.08.01.1','ep19','foundations','episode',4,'Share, Recover, and Succeed',19,'Recover Professionally When Technology Fails','foundations.html?ep=ep19&generic=1'),
  ('2026.08.01.1','ep20','foundations','episode',4,'Share, Recover, and Succeed',20,'Freshman Digital Readiness Simulation','foundations.html?ep=ep20&generic=1'),
  ('2026.08.01.1','q01','ai-quest','quest',1,'Understand the System',21,'AI Is a Pattern System, Not a Person','ai-quest.html?q=q01&generic=1'),
  ('2026.08.01.1','q02','ai-quest','quest',1,'Understand the System',22,'Generative AI Is Not the Same as Search','ai-quest.html?q=q02&generic=1'),
  ('2026.08.01.1','q03','ai-quest','quest',1,'Understand the System',23,'Why AI Hallucinates','ai-quest.html?q=q03&generic=1'),
  ('2026.08.01.1','q04','ai-quest','quest',1,'Understand the System',24,'Keep Human Judgment in the Loop','ai-quest.html?q=q04&generic=1'),
  ('2026.08.01.1','q05','ai-quest','quest',1,'Understand the System',25,'Build a Strong Prompt','ai-quest.html?q=q05&generic=1'),
  ('2026.08.01.1','q06','ai-quest','quest',2,'Learn and Create Responsibly',26,'Use AI as a Tutor, Not a Substitute','ai-quest.html?q=q06&generic=1'),
  ('2026.08.01.1','q07','ai-quest','quest',2,'Learn and Create Responsibly',27,'Use AI for Writing Support Without Losing Authorship','ai-quest.html?q=q07&generic=1'),
  ('2026.08.01.1','q08','ai-quest','quest',2,'Learn and Create Responsibly',28,'Use AI to Strengthen Research Questions','ai-quest.html?q=q08&generic=1'),
  ('2026.08.01.1','q09','ai-quest','quest',2,'Learn and Create Responsibly',29,'The Syllabus Is the Rulebook','ai-quest.html?q=q09&generic=1'),
  ('2026.08.01.1','q10','ai-quest','quest',2,'Learn and Create Responsibly',30,'Use the Green, Yellow, and Red Zone Model','ai-quest.html?q=q10&generic=1'),
  ('2026.08.01.1','q11','ai-quest','quest',3,'Integrity, Media, and Tool Judgment',31,'Disclose or Cite AI Use When Required','ai-quest.html?q=q11&generic=1'),
  ('2026.08.01.1','q12','ai-quest','quest',3,'Integrity, Media, and Tool Judgment',32,'Protect Original Work and Authorship','ai-quest.html?q=q12&generic=1'),
  ('2026.08.01.1','q13','ai-quest','quest',3,'Integrity, Media, and Tool Judgment',33,'Understand Chatbots and Writing Assistants','ai-quest.html?q=q13&generic=1'),
  ('2026.08.01.1','q14','ai-quest','quest',3,'Integrity, Media, and Tool Judgment',34,'Recognize Image, Audio, and Video AI Risks','ai-quest.html?q=q14&generic=1'),
  ('2026.08.01.1','q15','ai-quest','quest',3,'Integrity, Media, and Tool Judgment',35,'Use Coding and Data Assistants Responsibly','ai-quest.html?q=q15&generic=1'),
  ('2026.08.01.1','q16','ai-quest','quest',4,'Code, Automate, and Build Responsibly',36,'Understand AI Agents and Automation','ai-quest.html?q=q16&generic=1'),
  ('2026.08.01.1','q17','ai-quest','quest',4,'Code, Automate, and Build Responsibly',37,'Turn One Prompt Into a Repeatable Workflow','ai-quest.html?q=q17&generic=1'),
  ('2026.08.01.1','q18','ai-quest','quest',4,'Code, Automate, and Build Responsibly',38,'Vibe Code Without Flying Blind','ai-quest.html?q=q18&generic=1'),
  ('2026.08.01.1','q19','ai-quest','quest',4,'Code, Automate, and Build Responsibly',39,'Design an Agent With Boundaries','ai-quest.html?q=q19&generic=1'),
  ('2026.08.01.1','q20','ai-quest','quest',4,'Code, Automate, and Build Responsibly',40,'Final Quest — Use AI Without Losing Judgment','ai-quest.html?q=q20&generic=1');

create table public.digital_literacy_assignment_units (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  release_id text not null,
  unit_id text not null,
  position integer not null check (position between 1 and 40),
  primary key (assignment_id, unit_id),
  foreign key (release_id, unit_id)
    references public.digital_literacy_catalog_units(release_id, unit_id) on delete restrict
);

create table public.digital_literacy_assignment_recipients (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (assignment_id, student_id),
  check ((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null))
);

create table public.digital_literacy_assignment_progress (
  assignment_id uuid not null,
  student_id uuid not null,
  unit_id text not null,
  status text not null default 'completed' check (status='completed'),
  stars integer not null default 0 check (stars between 0 and 3),
  evidence_source text not null check (evidence_source in ('canonical_course_embed','canonical_course_account_sync')),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id, unit_id),
  foreign key (assignment_id, student_id)
    references public.digital_literacy_assignment_recipients(assignment_id, student_id) on delete cascade,
  foreign key (assignment_id, unit_id)
    references public.digital_literacy_assignment_units(assignment_id, unit_id) on delete cascade
);

create index digital_literacy_assignment_recipients_student_idx
  on public.digital_literacy_assignment_recipients(student_id, assigned_at desc);
create index digital_literacy_assignment_progress_student_idx
  on public.digital_literacy_assignment_progress(student_id, updated_at desc);
create index digital_literacy_assignment_units_release_idx
  on public.digital_literacy_assignment_units(release_id, unit_id);
create index digital_literacy_assignment_progress_assignment_unit_idx
  on public.digital_literacy_assignment_progress(assignment_id, unit_id);

create table public.digital_literacy_research_instrument_scopes (
  instrument_id uuid primary key references public.research_pilot_instruments(id) on delete restrict,
  release_id text not null references public.digital_literacy_catalog_releases(release_id) on delete restrict,
  phase text not null check (phase in ('before_assigned_units','after_assigned_units','anytime')),
  unit_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index digital_literacy_research_scopes_release_idx
  on public.digital_literacy_research_instrument_scopes(release_id);

create table private.research_export_secrets (
  pilot_version_id uuid primary key references public.research_pilot_versions(id) on delete cascade,
  pseudonym_key bytea not null default extensions.gen_random_bytes(32),
  created_at timestamptz not null default now()
);

revoke all on private.research_export_secrets from public, anon, authenticated;

create or replace function private.can_view_digital_literacy_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments assignment
    where assignment.id = p_assignment_id
      and (
        private.can_manage_course(assignment.course_id)
        or exists (
          select 1
          from public.digital_literacy_assignment_recipients recipient
          where recipient.assignment_id = assignment.id
            and recipient.student_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.attach_digital_literacy_research_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope jsonb := new.instrument_definition->'digital_literacy_scope';
  v_release_id text;
  v_phase text;
  v_unit_ids text[];
begin
  if v_scope is null then return new; end if;
  if jsonb_typeof(v_scope) <> 'object' then
    raise exception 'Digital Literacy instrument scope must be an object';
  end if;
  v_release_id := v_scope->>'release_id';
  v_phase := v_scope->>'phase';
  if jsonb_typeof(v_scope->'unit_ids') <> 'array' then
    raise exception 'Digital Literacy instrument scope requires unit IDs';
  end if;
  select coalesce(array_agg(value order by value), '{}'::text[])
  into v_unit_ids
  from jsonb_array_elements_text(v_scope->'unit_ids');
  if not exists (
    select 1 from public.digital_literacy_catalog_releases release
    where release.release_id=v_release_id and release.active
  ) then
    raise exception 'Canonical Digital Literacy release is not active';
  end if;
  if v_phase not in ('before_assigned_units','after_assigned_units','anytime') then
    raise exception 'Digital Literacy research phase is invalid';
  end if;
  if (new.instrument_kind='pre_assessment' and v_phase<>'before_assigned_units')
    or (new.instrument_kind='post_assessment' and v_phase<>'after_assigned_units') then
    raise exception 'Pre/post instruments must use their matching course phase';
  end if;
  if v_phase='after_assigned_units' and cardinality(v_unit_ids)=0 then
    raise exception 'Post-course instruments require canonical unit scope';
  end if;
  if exists (
    select 1 from unnest(v_unit_ids) requested(unit_id)
    where not exists (
      select 1 from public.digital_literacy_catalog_units unit
      where unit.release_id=v_release_id and unit.unit_id=requested.unit_id
    )
  ) then
    raise exception 'Digital Literacy research scope contains an unknown unit';
  end if;
  insert into public.digital_literacy_research_instrument_scopes (
    instrument_id, release_id, phase, unit_ids
  ) values (new.id, v_release_id, v_phase, v_unit_ids);
  return new;
end;
$$;

create trigger research_pilot_instruments_digital_literacy_scope
after insert on public.research_pilot_instruments
for each row execute function private.attach_digital_literacy_research_scope();

create or replace function private.ensure_research_export_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.research_export_secrets(pilot_version_id)
  values (new.id)
  on conflict (pilot_version_id) do nothing;
  return new;
end;
$$;

create trigger research_pilot_versions_export_secret
after insert on public.research_pilot_versions
for each row execute function private.ensure_research_export_secret();

insert into private.research_export_secrets(pilot_version_id)
select id from public.research_pilot_versions
on conflict (pilot_version_id) do nothing;

create or replace function private.enforce_digital_literacy_research_timing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope public.digital_literacy_research_instrument_scopes%rowtype;
  v_course_id uuid;
  v_required integer;
  v_completed integer;
begin
  select * into v_scope
  from public.digital_literacy_research_instrument_scopes
  where instrument_id=new.instrument_id;
  if not found or v_scope.phase='anytime' then return new; end if;
  select project.course_id into v_course_id
  from public.research_pilot_versions version
  join public.research_pilot_projects project on project.id=version.project_id
  where version.id=new.pilot_version_id;
  if v_scope.phase='before_assigned_units' then
    if exists (
      select 1
      from public.digital_literacy_assignment_progress progress
      join public.assignments assignment on assignment.id=progress.assignment_id
      where progress.student_id=new.participant_id
        and assignment.course_id=v_course_id
    ) then
      raise exception 'The pre-assessment window closed after course-unit completion began';
    end if;
    return new;
  end if;
  v_required := cardinality(v_scope.unit_ids);
  select count(distinct progress.unit_id)::integer into v_completed
  from public.digital_literacy_assignment_progress progress
  join public.assignments assignment on assignment.id=progress.assignment_id
  where progress.student_id=new.participant_id
    and assignment.course_id=v_course_id
    and progress.unit_id=any(v_scope.unit_ids);
  if v_completed < v_required then
    raise exception 'The post-course instrument opens only after the approved unit scope is complete';
  end if;
  return new;
end;
$$;

create trigger research_response_records_digital_literacy_timing
before insert on public.research_response_records
for each row execute function private.enforce_digital_literacy_research_timing();

alter table public.digital_literacy_catalog_releases enable row level security;
alter table public.digital_literacy_catalog_units enable row level security;
alter table public.digital_literacy_assignment_units enable row level security;
alter table public.digital_literacy_assignment_recipients enable row level security;
alter table public.digital_literacy_assignment_progress enable row level security;
alter table public.digital_literacy_research_instrument_scopes enable row level security;
alter table private.research_export_secrets enable row level security;

revoke all on
  public.digital_literacy_catalog_releases,
  public.digital_literacy_catalog_units,
  public.digital_literacy_assignment_units,
  public.digital_literacy_assignment_recipients,
  public.digital_literacy_assignment_progress,
  public.digital_literacy_research_instrument_scopes
from public, anon;

revoke insert,update,delete on
  public.digital_literacy_catalog_releases,
  public.digital_literacy_catalog_units,
  public.digital_literacy_assignment_units,
  public.digital_literacy_assignment_recipients,
  public.digital_literacy_assignment_progress,
  public.digital_literacy_research_instrument_scopes
from authenticated;

grant select on
  public.digital_literacy_catalog_releases,
  public.digital_literacy_catalog_units,
  public.digital_literacy_assignment_units,
  public.digital_literacy_assignment_recipients,
  public.digital_literacy_assignment_progress,
  public.digital_literacy_research_instrument_scopes
to authenticated;

create policy digital_literacy_catalog_releases_select
on public.digital_literacy_catalog_releases for select to authenticated
using (active);
create policy digital_literacy_catalog_units_select
on public.digital_literacy_catalog_units for select to authenticated
using (exists (
  select 1 from public.digital_literacy_catalog_releases release
  where release.release_id=digital_literacy_catalog_units.release_id and release.active
));
create policy digital_literacy_assignment_units_select
on public.digital_literacy_assignment_units for select to authenticated
using (private.can_view_digital_literacy_assignment(assignment_id));
create policy digital_literacy_assignment_recipients_select
on public.digital_literacy_assignment_recipients for select to authenticated
using (
  student_id=(select auth.uid())
  or private.can_view_digital_literacy_assignment(assignment_id)
);
create policy digital_literacy_assignment_progress_select
on public.digital_literacy_assignment_progress for select to authenticated
using (
  student_id=(select auth.uid())
  or private.can_view_digital_literacy_assignment(assignment_id)
);
create policy digital_literacy_research_instrument_scopes_select
on public.digital_literacy_research_instrument_scopes for select to authenticated
using (private.can_view_research_version((
  select instrument.pilot_version_id
  from public.research_pilot_instruments instrument
  where instrument.id=instrument_id
)));

-- Research exports must use the governed pseudonymized RPC. Course managers do
-- not receive participant identifiers by selecting response rows directly.
drop policy if exists research_response_records_select on public.research_response_records;
create policy research_response_records_select
on public.research_response_records for select to authenticated
using (participant_id=(select auth.uid()));

create or replace function public.get_digital_literacy_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_release public.digital_literacy_catalog_releases%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_release
  from public.digital_literacy_catalog_releases release
  where release.course_key='brexatlas.digital-literacy-course' and release.active
  order by release.created_at desc
  limit 1;
  if not found then raise exception 'Canonical Digital Literacy catalog is unavailable'; end if;
  return jsonb_build_object(
    'release_id', v_release.release_id,
    'course_key', v_release.course_key,
    'title', v_release.title,
    'source_repository', v_release.source_repository,
    'source_home', v_release.source_home,
    'manifest_url', v_release.manifest_url,
    'manifest_sha256', v_release.manifest_sha256,
    'content_ownership', 'canonical-repository',
    'units', (
      select jsonb_agg(jsonb_build_object(
        'unit_id', unit.unit_id,
        'path', unit.path,
        'unit_kind', unit.unit_kind,
        'group_number', unit.group_number,
        'group_title', unit.group_title,
        'position', unit.position,
        'title', unit.title,
        'relative_url', unit.relative_url
      ) order by unit.position)
      from public.digital_literacy_catalog_units unit
      where unit.release_id=v_release.release_id
    )
  );
end;
$$;

create or replace function public.create_digital_literacy_assignment(
  p_course_id uuid,
  p_title text,
  p_due_at timestamptz,
  p_unit_ids text[],
  p_student_ids uuid[] default null,
  p_instructions text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course public.courses%rowtype;
  v_assignment public.assignments%rowtype;
  v_release_id text;
  v_unit_count integer;
  v_distinct_unit_count integer;
  v_recipient_count integer;
  v_distinct_student_count integer;
  v_recipient record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) then raise exception 'Course management access required'; end if;
  select * into v_course from public.courses where id=p_course_id;
  if not found then raise exception 'Course not found'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 3 and 220 then
    raise exception 'Assignment title must be 3 to 220 characters';
  end if;
  if p_due_at is null or p_due_at <= now() then raise exception 'A future due date is required'; end if;
  if coalesce(cardinality(p_unit_ids),0) not between 1 and 40 then
    raise exception 'Choose between 1 and 40 canonical course units';
  end if;
  select count(distinct unit_id)::integer into v_distinct_unit_count from unnest(p_unit_ids) unit_id;
  if v_distinct_unit_count<>cardinality(p_unit_ids) then raise exception 'Course units cannot be duplicated'; end if;
  select release_id into v_release_id
  from public.digital_literacy_catalog_releases
  where course_key='brexatlas.digital-literacy-course' and active;
  select count(*)::integer into v_unit_count
  from public.digital_literacy_catalog_units unit
  where unit.release_id=v_release_id and unit.unit_id=any(p_unit_ids);
  if v_unit_count<>cardinality(p_unit_ids) then raise exception 'Assignment includes an unknown canonical unit'; end if;
  if p_student_ids is not null then
    if cardinality(p_student_ids)=0 then raise exception 'Choose at least one current learner'; end if;
    select count(distinct student_id)::integer into v_distinct_student_count from unnest(p_student_ids) student_id;
    if v_distinct_student_count<>cardinality(p_student_ids) then raise exception 'Learners cannot be duplicated'; end if;
  end if;

  insert into public.assignments (
    course_id, professor_id, title, instructions, due_at, status,
    syllabus_section, learner_preview, settings
  ) values (
    p_course_id,
    v_user_id,
    btrim(p_title),
    left(btrim(coalesce(p_instructions,'')),5000),
    p_due_at,
    'published',
    jsonb_build_object('source','canonical-repository','course_key','brexatlas.digital-literacy-course'),
    jsonb_build_object('unit_count',v_unit_count,'delivery','in-platform'),
    jsonb_build_object(
      'kind','digital_literacy_course_units',
      'catalog_release',v_release_id,
      'source_repository','https://github.com/BREXAtlas/Digital-Literacy-Course',
      'research_participation_required',false
    )
  ) returning * into v_assignment;

  insert into public.digital_literacy_assignment_units (
    assignment_id, release_id, unit_id, position
  )
  select v_assignment.id, unit.release_id, unit.unit_id, unit.position
  from public.digital_literacy_catalog_units unit
  where unit.release_id=v_release_id and unit.unit_id=any(p_unit_ids)
  order by unit.position;

  insert into public.digital_literacy_assignment_recipients(assignment_id,student_id)
  select v_assignment.id, membership.user_id
  from public.course_memberships membership
  where membership.course_id=p_course_id
    and membership.role='learner'
    and private.course_membership_is_current(membership.course_id,membership.user_id,membership.role)
    and (p_student_ids is null or membership.user_id=any(p_student_ids));
  get diagnostics v_recipient_count = row_count;
  if v_recipient_count=0 then raise exception 'No current learners are available for this assignment'; end if;
  if p_student_ids is not null and v_recipient_count<>cardinality(p_student_ids) then
    raise exception 'Every selected learner must be a current course member';
  end if;

  for v_recipient in
    select recipient.student_id
    from public.digital_literacy_assignment_recipients recipient
    where recipient.assignment_id=v_assignment.id
  loop
    perform private.create_student_course_notification(
      v_recipient.student_id,
      p_course_id,
      'course_assigned',
      'Digital Literacy assignment ready',
      format('%s · %s canonical unit%s · due %s',
        v_assignment.title,
        v_unit_count,
        case when v_unit_count=1 then '' else 's' end,
        to_char(v_assignment.due_at at time zone 'America/Chicago','Mon DD, YYYY at HH12:MI AM')
      ),
      'course',
      'digital-literacy-assignment:' || v_assignment.id::text
    );
  end loop;

  insert into public.audit_events (
    actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_course.institution_id,p_course_id,
    'digital_literacy.assignment_published','assignment',v_assignment.id::text,
    jsonb_build_object(
      'catalog_release',v_release_id,
      'unit_count',v_unit_count,
      'recipient_count',v_recipient_count,
      'due_at',v_assignment.due_at,
      'research_participation_required',false
    ),''
  );

  return jsonb_build_object(
    'assignment_id',v_assignment.id,
    'course_id',v_assignment.course_id,
    'title',v_assignment.title,
    'due_at',v_assignment.due_at,
    'catalog_release',v_release_id,
    'unit_count',v_unit_count,
    'recipient_count',v_recipient_count,
    'status',v_assignment.status
  );
end;
$$;

create or replace function public.get_digital_literacy_professor_workspace(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_course public.courses%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) then raise exception 'Course management access required'; end if;
  select * into v_course from public.courses where id=p_course_id;
  return jsonb_build_object(
    'course',jsonb_build_object('id',v_course.id,'title',v_course.title,'course_code',v_course.course_code),
    'catalog',public.get_digital_literacy_catalog(),
    'learners',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'student_id',profile.id,
        'display_name',coalesce(nullif(btrim(profile.full_name),''),split_part(profile.email,'@',1),'Student')
      ) order by coalesce(nullif(btrim(profile.full_name),''),profile.email)), '[]'::jsonb)
      from public.course_memberships membership
      join public.profiles profile on profile.id=membership.user_id
      where membership.course_id=p_course_id
        and membership.role='learner'
        and private.course_membership_is_current(membership.course_id,membership.user_id,membership.role)
    ),
    'assignments',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id',assignment.id,
        'title',assignment.title,
        'instructions',assignment.instructions,
        'due_at',assignment.due_at,
        'status',assignment.status,
        'catalog_release',assignment.settings->>'catalog_release',
        'units',(
          select jsonb_agg(jsonb_build_object(
            'unit_id',unit.unit_id,'title',catalog.title,'path',catalog.path,
            'position',catalog.position,'relative_url',catalog.relative_url
          ) order by catalog.position)
          from public.digital_literacy_assignment_units unit
          join public.digital_literacy_catalog_units catalog
            on catalog.release_id=unit.release_id and catalog.unit_id=unit.unit_id
          where unit.assignment_id=assignment.id
        ),
        'recipients',(
          select coalesce(jsonb_agg(jsonb_build_object(
            'student_id',recipient.student_id,
            'display_name',coalesce(nullif(btrim(profile.full_name),''),split_part(profile.email,'@',1),'Student'),
            'status',recipient.status,
            'completed_at',recipient.completed_at,
            'completed_units',(
              select count(*) from public.digital_literacy_assignment_progress progress
              where progress.assignment_id=recipient.assignment_id and progress.student_id=recipient.student_id
            )
          ) order by coalesce(nullif(btrim(profile.full_name),''),profile.email)), '[]'::jsonb)
          from public.digital_literacy_assignment_recipients recipient
          join public.profiles profile on profile.id=recipient.student_id
          where recipient.assignment_id=assignment.id
        )
      ) order by assignment.created_at desc), '[]'::jsonb)
      from public.assignments assignment
      where assignment.course_id=p_course_id
        and assignment.settings->>'kind'='digital_literacy_course_units'
    ),
    'research',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'project_id',project.id,
        'project_title',project.title,
        'version_id',version.id,
        'version_number',version.version_number,
        'status',version.status,
        'blockers',private.research_version_blockers(version.id,true,now()),
        'purpose_statement',version.purpose_statement,
        'activities',version.research_activities,
        'export_mode',version.export_rules->>'mode'
      ) order by version.version_number desc), '[]'::jsonb)
      from public.research_pilot_projects project
      join public.research_pilot_versions version on version.project_id=project.id
      where project.course_id=p_course_id
    )
  );
end;
$$;

create or replace function public.get_my_digital_literacy_assignments(p_course_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'content_ownership','canonical-repository',
    'assignments',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id',assignment.id,
        'course_id',assignment.course_id,
        'course_title',course.title,
        'course_code',course.course_code,
        'title',assignment.title,
        'instructions',assignment.instructions,
        'due_at',assignment.due_at,
        'status',recipient.status,
        'completed_at',recipient.completed_at,
        'catalog_release',assignment.settings->>'catalog_release',
        'source_home',release.source_home,
        'source_repository',release.source_repository,
        'units',(
          select jsonb_agg(jsonb_build_object(
            'unit_id',unit.unit_id,
            'title',catalog.title,
            'path',catalog.path,
            'position',catalog.position,
            'relative_url',catalog.relative_url,
            'completed',progress.unit_id is not null,
            'stars',coalesce(progress.stars,0),
            'completed_at',progress.completed_at
          ) order by catalog.position)
          from public.digital_literacy_assignment_units unit
          join public.digital_literacy_catalog_units catalog
            on catalog.release_id=unit.release_id and catalog.unit_id=unit.unit_id
          left join public.digital_literacy_assignment_progress progress
            on progress.assignment_id=unit.assignment_id
            and progress.student_id=v_user_id
            and progress.unit_id=unit.unit_id
          where unit.assignment_id=assignment.id
        )
      ) order by recipient.status<>'completed',assignment.due_at,assignment.created_at desc), '[]'::jsonb)
      from public.digital_literacy_assignment_recipients recipient
      join public.assignments assignment on assignment.id=recipient.assignment_id
      join public.courses course on course.id=assignment.course_id
      join public.digital_literacy_catalog_releases release
        on release.release_id=assignment.settings->>'catalog_release'
      where recipient.student_id=v_user_id
        and assignment.status='published'
        and (p_course_id is null or assignment.course_id=p_course_id)
        and private.course_membership_is_current(assignment.course_id,v_user_id,'learner')
    )
  );
end;
$$;

create or replace function public.sync_digital_literacy_assignment_progress(
  p_path text,
  p_completed_node_ids text[],
  p_stars jsonb,
  p_catalog_release text,
  p_evidence_source text default 'canonical_course_embed'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_completed_count integer := coalesce(cardinality(p_completed_node_ids),0);
  v_distinct_count integer;
  v_changed integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_path not in ('foundations','ai-quest') then raise exception 'Canonical course path is invalid'; end if;
  if p_evidence_source not in ('canonical_course_embed','canonical_course_account_sync') then
    raise exception 'Digital Literacy evidence source is invalid';
  end if;
  if v_completed_count>20 then raise exception 'A course path cannot contain more than 20 units'; end if;
  if p_stars is null or jsonb_typeof(p_stars)<>'object' then raise exception 'Stars must use a bounded object'; end if;
  perform 1
  from public.digital_literacy_catalog_releases release
  where release.release_id=p_catalog_release
    and release.course_key='brexatlas.digital-literacy-course'
    and release.active;
  if not found then raise exception 'Canonical Digital Literacy release is not active'; end if;
  if v_completed_count>0 then
    select count(distinct unit_id)::integer into v_distinct_count
    from unnest(p_completed_node_ids) unit_id;
    if v_distinct_count<>v_completed_count then raise exception 'Completed units cannot be duplicated'; end if;
    if exists (
      select 1 from unnest(p_completed_node_ids) requested(unit_id)
      where not exists (
        select 1 from public.digital_literacy_catalog_units unit
        where unit.release_id=p_catalog_release
          and unit.path=p_path
          and unit.unit_id=requested.unit_id
      )
    ) then
      raise exception 'Progress contains an unknown canonical course unit';
    end if;
  end if;

  insert into public.digital_literacy_progress (
    user_id,path,current_node_id,completed_node_ids,stars,updated_at
  ) values (
    v_user_id,
    p_path,
    case when v_completed_count>0 then p_completed_node_ids[v_completed_count] else null end,
    coalesce(p_completed_node_ids,'{}'::text[]),
    p_stars,
    now()
  )
  on conflict (user_id,path) do update set
    current_node_id=excluded.current_node_id,
    completed_node_ids=excluded.completed_node_ids,
    stars=excluded.stars,
    updated_at=excluded.updated_at;

  if v_completed_count>0 then
    insert into public.digital_literacy_assignment_progress (
      assignment_id,student_id,unit_id,status,stars,evidence_source,completed_at,updated_at
    )
    select
      recipient.assignment_id,
      v_user_id,
      unit.unit_id,
      'completed',
      case
        when jsonb_typeof(p_stars->unit.unit_id)='number'
          then least(3,greatest(0,(p_stars->>unit.unit_id)::integer))
        else 0
      end,
      p_evidence_source,
      now(),
      now()
    from public.digital_literacy_assignment_recipients recipient
    join public.assignments assignment on assignment.id=recipient.assignment_id
    join public.digital_literacy_assignment_units assignment_unit
      on assignment_unit.assignment_id=recipient.assignment_id
    join public.digital_literacy_catalog_units unit
      on unit.release_id=assignment_unit.release_id and unit.unit_id=assignment_unit.unit_id
    where recipient.student_id=v_user_id
      and assignment.status='published'
      and unit.release_id=p_catalog_release
      and unit.path=p_path
      and unit.unit_id=any(p_completed_node_ids)
      and private.course_membership_is_current(assignment.course_id,v_user_id,'learner')
    on conflict (assignment_id,student_id,unit_id) do update set
      stars=greatest(public.digital_literacy_assignment_progress.stars,excluded.stars),
      evidence_source=excluded.evidence_source,
      updated_at=excluded.updated_at;
    get diagnostics v_changed = row_count;
  end if;

  update public.digital_literacy_assignment_recipients recipient
  set status='in_progress'
  where recipient.student_id=v_user_id
    and recipient.status='assigned'
    and exists (
      select 1 from public.digital_literacy_assignment_progress progress
      where progress.assignment_id=recipient.assignment_id and progress.student_id=v_user_id
    );

  update public.digital_literacy_assignment_recipients recipient
  set status='completed',completed_at=coalesce(recipient.completed_at,now())
  where recipient.student_id=v_user_id
    and recipient.status<>'completed'
    and not exists (
      select 1
      from public.digital_literacy_assignment_units required_unit
      where required_unit.assignment_id=recipient.assignment_id
        and not exists (
          select 1
          from public.digital_literacy_assignment_progress progress
          where progress.assignment_id=recipient.assignment_id
            and progress.student_id=v_user_id
            and progress.unit_id=required_unit.unit_id
        )
    );

  if v_changed>0 then
    insert into public.audit_events (
      actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash
    )
    select
      v_user_id,
      course.institution_id,
      assignment.course_id,
      'digital_literacy.progress_synchronized',
      'digital_literacy_catalog_release',
      p_catalog_release,
      jsonb_build_object(
        'path',p_path,
        'completed_count',v_completed_count,
        'assignment_rows_changed',v_changed,
        'evidence_source',p_evidence_source
      ),
      ''
    from public.digital_literacy_assignment_recipients recipient
    join public.assignments assignment on assignment.id=recipient.assignment_id
    join public.courses course on course.id=assignment.course_id
    where recipient.student_id=v_user_id
    order by assignment.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'catalog_release',p_catalog_release,
    'path',p_path,
    'completed_node_ids',coalesce(p_completed_node_ids,'{}'::text[]),
    'assignment_rows_changed',v_changed,
    'assignments',public.get_my_digital_literacy_assignments(null)->'assignments'
  );
end;
$$;

create or replace function public.get_my_active_digital_literacy_research(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.course_memberships membership
    where membership.course_id=p_course_id
      and membership.user_id=v_user_id
      and membership.role='learner'
      and private.course_membership_is_current(membership.course_id,membership.user_id,membership.role)
  ) then raise exception 'Current learner course membership is required'; end if;
  return jsonb_build_object(
    'course_id',p_course_id,
    'course_work_requires_research_participation',false,
    'ordinary_course_feedback_unchanged',true,
    'projects',(
      select coalesce(jsonb_agg(jsonb_build_object(
        'project_id',project.id,
        'version_id',version.id,
        'version_number',version.version_number,
        'title',project.title,
        'purpose_statement',version.purpose_statement,
        'notice',version.notice_config,
        'consent',version.consent_config,
        'effective_at',version.effective_at,
        'expires_at',version.expires_at,
        'participation_status',coalesce(participation.participation_status,'not_enrolled'),
        'choice_recorded_at',participation.choice_recorded_at,
        'instruments',(
          select coalesce(jsonb_agg(jsonb_build_object(
            'instrument_id',instrument.id,
            'instrument_key',instrument.instrument_key,
            'instrument_version',instrument.instrument_version,
            'instrument_kind',instrument.instrument_kind,
            'title',instrument.title,
            'definition',instrument.instrument_definition,
            'phase',scope.phase,
            'unit_ids',scope.unit_ids,
            'submitted',response.id is not null,
            'submitted_at',response.submitted_at,
            'available',case
              when response.id is not null then false
              when scope.phase is null or scope.phase='anytime' then true
              when scope.phase='before_assigned_units' then not exists (
                select 1
                from public.digital_literacy_assignment_progress progress
                join public.assignments assignment on assignment.id=progress.assignment_id
                where progress.student_id=v_user_id and assignment.course_id=p_course_id
              )
              else cardinality(scope.unit_ids)=(
                select count(distinct progress.unit_id)::integer
                from public.digital_literacy_assignment_progress progress
                join public.assignments assignment on assignment.id=progress.assignment_id
                where progress.student_id=v_user_id
                  and assignment.course_id=p_course_id
                  and progress.unit_id=any(scope.unit_ids)
              )
            end
          ) order by instrument.instrument_kind,instrument.title), '[]'::jsonb)
          from public.research_pilot_instruments instrument
          left join public.digital_literacy_research_instrument_scopes scope
            on scope.instrument_id=instrument.id
          left join public.research_response_records response
            on response.instrument_id=instrument.id
            and response.participant_id=v_user_id
            and response.deleted_at is null
          where instrument.pilot_version_id=version.id
        )
      ) order by version.version_number desc), '[]'::jsonb)
      from public.research_pilot_projects project
      join public.research_pilot_versions version on version.project_id=project.id
      left join public.research_participation_states participation
        on participation.pilot_version_id=version.id and participation.participant_id=v_user_id
      where project.course_id=p_course_id
        and version.status='active'
        and private.research_version_blockers(version.id,true,now())='[]'::jsonb
    )
  );
end;
$$;

create or replace function public.export_digital_literacy_research_dataset(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_version public.research_pilot_versions%rowtype;
  v_project public.research_pilot_projects%rowtype;
  v_secret bytea;
  v_minimum_cohort integer := 5;
  v_participant_count integer;
  v_export jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_version from public.research_pilot_versions where id=p_version_id;
  if not found then raise exception 'Research project version not found'; end if;
  select * into v_project from public.research_pilot_projects where id=v_version.project_id;
  if not private.can_govern_research_project(v_project.id) then
    raise exception 'Institution research governance access required';
  end if;
  if private.research_version_blockers(v_version.id,true,now())<>'[]'::jsonb then
    raise exception 'Research export remains blocked until every approved gate is active';
  end if;
  if v_version.export_rules->>'mode'<>'approved_scoped' then
    raise exception 'The approved version does not permit a scoped research export';
  end if;
  if coalesce(v_version.export_rules->>'minimum_cohort_size','') ~ '^[0-9]+$' then
    v_minimum_cohort := greatest(3,least(100,(v_version.export_rules->>'minimum_cohort_size')::integer));
  end if;
  select count(distinct response.participant_id)::integer into v_participant_count
  from public.research_response_records response
  join public.research_participation_states participation
    on participation.pilot_version_id=response.pilot_version_id
    and participation.participant_id=response.participant_id
  where response.pilot_version_id=p_version_id
    and response.deleted_at is null
    and response.withdrawn_at is null
    and participation.participation_status='consented'
    and participation.withdrawn_at is null;
  if v_participant_count<v_minimum_cohort then
    raise exception 'Minimum approved cohort size has not been reached';
  end if;
  select pseudonym_key into v_secret
  from private.research_export_secrets
  where pilot_version_id=p_version_id;
  if v_secret is null then raise exception 'Research export pseudonym key is unavailable'; end if;

  select jsonb_build_object(
    'export_kind','pseudonymized_direct_identifier_free',
    'version_id',p_version_id,
    'course_id',v_project.course_id,
    'generated_at',now(),
    'participant_count',v_participant_count,
    'minimum_cohort_size',v_minimum_cohort,
    'identity_key_included',false,
    'warning','Pseudonymized records are not anonymous. Free text requires the approved manual disclosure review before external sharing.',
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'participant_code',encode(extensions.hmac(
        convert_to(response.participant_id::text,'UTF8'),v_secret,'sha256'
      ),'hex'),
      'instrument_key',instrument.instrument_key,
      'instrument_version',instrument.instrument_version,
      'instrument_kind',instrument.instrument_kind,
      'submitted_at',response.submitted_at,
      'response',case
        when instrument.instrument_kind in ('qualitative_interview','open_ended_survey')
          and v_version.export_rules->>'qualitative_mode'<>'pseudonymized_with_manual_redaction'
          then null
        else response.response_payload
      end,
      'response_hash',response.response_hash,
      'manual_text_review_required',instrument.instrument_kind in ('qualitative_interview','open_ended_survey'),
      'assigned_unit_completion',(
        select jsonb_build_object(
          'assigned_units',count(distinct assignment_unit.unit_id),
          'completed_units',count(distinct progress.unit_id)
        )
        from public.digital_literacy_assignment_recipients recipient
        join public.assignments assignment on assignment.id=recipient.assignment_id
        join public.digital_literacy_assignment_units assignment_unit
          on assignment_unit.assignment_id=recipient.assignment_id
        left join public.digital_literacy_assignment_progress progress
          on progress.assignment_id=recipient.assignment_id
          and progress.student_id=recipient.student_id
          and progress.unit_id=assignment_unit.unit_id
        where recipient.student_id=response.participant_id
          and assignment.course_id=v_project.course_id
      )
    ) order by instrument.instrument_kind,response.submitted_at),'[]'::jsonb)
  ) into v_export
  from public.research_response_records response
  join public.research_pilot_instruments instrument on instrument.id=response.instrument_id
  join public.research_participation_states participation
    on participation.pilot_version_id=response.pilot_version_id
    and participation.participant_id=response.participant_id
  where response.pilot_version_id=p_version_id
    and response.deleted_at is null
    and response.withdrawn_at is null
    and participation.participation_status='consented'
    and participation.withdrawn_at is null;

  insert into public.audit_events (
    actor_id,institution_id,course_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,v_project.institution_id,v_project.course_id,
    'research.pseudonymized_export_generated','research_pilot_version',p_version_id::text,
    jsonb_build_object(
      'participant_count',v_participant_count,
      'minimum_cohort_size',v_minimum_cohort,
      'direct_identifiers_included',false,
      'qualitative_mode',coalesce(v_version.export_rules->>'qualitative_mode','excluded')
    ),''
  );
  return v_export;
end;
$$;

revoke all on function private.can_view_digital_literacy_assignment(uuid) from public;
revoke all on function private.attach_digital_literacy_research_scope() from public;
revoke all on function private.ensure_research_export_secret() from public;
revoke all on function private.enforce_digital_literacy_research_timing() from public;
grant execute on function private.can_view_digital_literacy_assignment(uuid) to authenticated;

revoke all on function public.get_digital_literacy_catalog() from public,anon;
revoke all on function public.create_digital_literacy_assignment(uuid,text,timestamptz,text[],uuid[],text) from public,anon;
revoke all on function public.get_digital_literacy_professor_workspace(uuid) from public,anon;
revoke all on function public.get_my_digital_literacy_assignments(uuid) from public,anon;
revoke all on function public.sync_digital_literacy_assignment_progress(text,text[],jsonb,text,text) from public,anon;
revoke all on function public.get_my_active_digital_literacy_research(uuid) from public,anon;
revoke all on function public.export_digital_literacy_research_dataset(uuid) from public,anon;

grant execute on function public.get_digital_literacy_catalog() to authenticated;
grant execute on function public.create_digital_literacy_assignment(uuid,text,timestamptz,text[],uuid[],text) to authenticated;
grant execute on function public.get_digital_literacy_professor_workspace(uuid) to authenticated;
grant execute on function public.get_my_digital_literacy_assignments(uuid) to authenticated;
grant execute on function public.sync_digital_literacy_assignment_progress(text,text[],jsonb,text,text) to authenticated;
grant execute on function public.get_my_active_digital_literacy_research(uuid) to authenticated;
grant execute on function public.export_digital_literacy_research_dataset(uuid) to authenticated;
