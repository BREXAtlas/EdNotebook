-- Integrate the canonical Ram Ready Financial Futures course as a free,
-- platform-standard Early Prep class. The catalog is repository-backed;
-- learner progress is private and release-versioned; teacher visibility is
-- limited to current learners in a K-12 class the caller manages.

create table public.financial_literacy_catalog_releases (
  release_id text primary key,
  course_key text not null,
  title text not null,
  source_repository text not null,
  source_home text not null,
  content_commit text not null,
  unit_count integer not null check (unit_count=40),
  active boolean not null default false,
  validated_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (course_key,release_id)
);

create unique index financial_literacy_one_active_release_idx
  on public.financial_literacy_catalog_releases(course_key)
  where active;

create table public.financial_literacy_catalog_units (
  release_id text not null references public.financial_literacy_catalog_releases(release_id) on delete restrict,
  unit_id text not null,
  path text not null check (path in ('foundations','wealth-quest')),
  group_number integer not null check (group_number between 1 and 4),
  group_title text not null,
  title text not null,
  position integer not null check (position between 1 and 40),
  relative_url text not null,
  primary key (release_id,unit_id),
  unique (release_id,position)
);

insert into public.financial_literacy_catalog_releases (
  release_id,course_key,title,source_repository,source_home,content_commit,unit_count,active,validated_at
) values (
  '2026.08.08.1','brexatlas.financial-literacy-course','Ram Ready Financial Futures',
  'https://github.com/BREXAtlas/Financial-Literacy-Course',
  'https://brexatlas.github.io/Financial-Literacy-Course/',
  '237301955de36d335d3d15858258b57fbc63f1b9',40,true,'2026-08-08T22:49:00Z'
);

insert into public.financial_literacy_catalog_units (
  release_id,unit_id,path,group_number,group_title,title,position,relative_url
) values
  ('2026.08.08.1','ep01','foundations',1,'Act I · Starting Out','Your Future, Your Values',1,'foundations.html?ep=ep01'),
  ('2026.08.08.1','ep02','foundations',1,'Act I · Starting Out','Where Money Lives',2,'foundations.html?ep=ep02'),
  ('2026.08.08.1','ep03','foundations',1,'Act I · Starting Out','Your First Paycheck',3,'foundations.html?ep=ep03'),
  ('2026.08.08.1','ep04','foundations',1,'Act I · Starting Out','Give Every Dollar a Job',4,'foundations.html?ep=ep04'),
  ('2026.08.08.1','ep05','foundations',1,'Act I · Starting Out','Credit Is a Contract, Not Free Money',5,'foundations.html?ep=ep05'),
  ('2026.08.08.1','ep06','foundations',2,'Act II · Building Stability','When Life Interrupts the Plan',6,'foundations.html?ep=ep06'),
  ('2026.08.08.1','ep07','foundations',2,'Act II · Building Stability','The Real Cost of Getting Around',7,'foundations.html?ep=ep07'),
  ('2026.08.08.1','ep08','foundations',2,'Act II · Building Stability','Education, Career, and Return on Investment',8,'foundations.html?ep=ep08'),
  ('2026.08.08.1','ep09','foundations',2,'Act II · Building Stability','Taxes, Filing, and Records',9,'foundations.html?ep=ep09'),
  ('2026.08.08.1','ep10','foundations',2,'Act II · Building Stability','Benefits Are Part of Compensation',10,'foundations.html?ep=ep10'),
  ('2026.08.08.1','ep11','foundations',3,'Act III · Growing Capacity','What You Own and What You Owe',11,'foundations.html?ep=ep11'),
  ('2026.08.08.1','ep12','foundations',3,'Act III · Growing Capacity','Cash Tools—Savings, CDs, and Treasury Bills',12,'foundations.html?ep=ep12'),
  ('2026.08.08.1','ep13','foundations',3,'Act III · Growing Capacity','Stocks, Bonds, and Diversified Funds',13,'foundations.html?ep=ep13'),
  ('2026.08.08.1','ep14','foundations',3,'Act III · Growing Capacity','Starting Something—Sole Proprietorship, LLC, or Corporation',14,'foundations.html?ep=ep14'),
  ('2026.08.08.1','ep15','foundations',3,'Act III · Growing Capacity','Keep Business and Personal Money Separate',15,'foundations.html?ep=ep15'),
  ('2026.08.08.1','ep16','foundations',4,'Act IV · Planning Forward','Rent, Buy, Share, or Stay Flexible',16,'foundations.html?ep=ep16'),
  ('2026.08.08.1','ep17','foundations',4,'Act IV · Planning Forward','Protect the Plan',17,'foundations.html?ep=ep17'),
  ('2026.08.08.1','ep18','foundations',4,'Act IV · Planning Forward','Money With Other People',18,'foundations.html?ep=ep18'),
  ('2026.08.08.1','ep19','foundations',4,'Act IV · Planning Forward','Track Wealth Without Letting It Define You',19,'foundations.html?ep=ep19'),
  ('2026.08.08.1','ep20','foundations',4,'Act IV · Planning Forward','Road to $1.5 Million—Build, Stress-Test, Revise',20,'foundations.html?ep=ep20'),
  ('2026.08.08.1','q01','wealth-quest',1,'Tier I · Understanding Wealth','A Million Dollars Is a Balance Sheet, Not a Pile of Cash',21,'wealth-quest.html?q=q01'),
  ('2026.08.08.1','q02','wealth-quest',1,'Tier I · Understanding Wealth','High Income Versus Durable Wealth',22,'wealth-quest.html?q=q02'),
  ('2026.08.08.1','q03','wealth-quest',1,'Tier I · Understanding Wealth','Athlete, Entertainer, and Creator Income Shock',23,'wealth-quest.html?q=q03'),
  ('2026.08.08.1','q04','wealth-quest',1,'Tier I · Understanding Wealth','Business Equity and Scale',24,'wealth-quest.html?q=q04'),
  ('2026.08.08.1','q05','wealth-quest',1,'Tier I · Understanding Wealth','Build the Team, Keep the Judgment',25,'wealth-quest.html?q=q05'),
  ('2026.08.08.1','q06','wealth-quest',2,'Tier II · Managing Complexity','Private Banking—Service, Credit, and Fees',26,'wealth-quest.html?q=q06'),
  ('2026.08.08.1','q07','wealth-quest',2,'Tier II · Managing Complexity','An Investment Policy Is a Decision System',27,'wealth-quest.html?q=q07'),
  ('2026.08.08.1','q08','wealth-quest',2,'Tier II · Managing Complexity','Private Investments and Illiquidity',28,'wealth-quest.html?q=q08'),
  ('2026.08.08.1','q09','wealth-quest',2,'Tier II · Managing Complexity','Tax Complexity and Entity Discipline',29,'wealth-quest.html?q=q09'),
  ('2026.08.08.1','q10','wealth-quest',2,'Tier II · Managing Complexity','Estate, Trust, Beneficiary, and Giving Basics',30,'wealth-quest.html?q=q10'),
  ('2026.08.08.1','q11','wealth-quest',3,'Tier III · Governance and Risk','Family Office or Outsourced Experts',31,'wealth-quest.html?q=q11'),
  ('2026.08.08.1','q12','wealth-quest',3,'Tier III · Governance and Risk','Governance Prevents Expensive Confusion',32,'wealth-quest.html?q=q12'),
  ('2026.08.08.1','q13','wealth-quest',3,'Tier III · Governance and Risk','Concentrated Stock and Liquidity',33,'wealth-quest.html?q=q13'),
  ('2026.08.08.1','q14','wealth-quest',3,'Tier III · Governance and Risk','Borrowing Against Assets',34,'wealth-quest.html?q=q14'),
  ('2026.08.08.1','q15','wealth-quest',3,'Tier III · Governance and Risk','Visibility, Security, Reputation, and Responsibility',35,'wealth-quest.html?q=q15'),
  ('2026.08.08.1','q16','wealth-quest',4,'Tier IV · Ownership at Scale','Billionaire Wealth Is Usually Ownership, Not Cash',36,'wealth-quest.html?q=q16'),
  ('2026.08.08.1','q17','wealth-quest',4,'Tier IV · Ownership at Scale','Valuation, Control, and Market Risk',37,'wealth-quest.html?q=q17'),
  ('2026.08.08.1','q18','wealth-quest',4,'Tier IV · Ownership at Scale','Regulation, Tax, Labor, and Public Scrutiny',38,'wealth-quest.html?q=q18'),
  ('2026.08.08.1','q19','wealth-quest',4,'Tier IV · Ownership at Scale','Philanthropy, Foundations, and Power',39,'wealth-quest.html?q=q19'),
  ('2026.08.08.1','q20','wealth-quest',4,'Tier IV · Ownership at Scale','The Multi-Billion-Dollar Boardroom',40,'wealth-quest.html?q=q20');

create table private.financial_literacy_standard_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  started_release_id text not null references public.financial_literacy_catalog_releases(release_id) on delete restrict,
  current_release_id text not null references public.financial_literacy_catalog_releases(release_id) on delete restrict,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,student_id)
);

create index financial_literacy_enrollment_release_idx
  on private.financial_literacy_standard_enrollments(current_release_id,student_id);

create table private.financial_literacy_standard_progress (
  enrollment_id uuid not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  release_id text not null,
  unit_id text not null,
  evidence_source text not null default 'learner_confirmed_canonical_course'
    check (evidence_source='learner_confirmed_canonical_course'),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id,release_id,unit_id),
  foreign key (enrollment_id,student_id)
    references private.financial_literacy_standard_enrollments(id,student_id) on delete cascade,
  foreign key (release_id,unit_id)
    references public.financial_literacy_catalog_units(release_id,unit_id) on delete restrict
);

create index financial_literacy_progress_enrollment_idx
  on private.financial_literacy_standard_progress(enrollment_id,student_id);
create index financial_literacy_progress_release_unit_idx
  on private.financial_literacy_standard_progress(release_id,unit_id);

create table private.financial_literacy_standard_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  release_id text not null references public.financial_literacy_catalog_releases(release_id) on delete restrict,
  badge_key text not null check (badge_key in ('foundations-complete','full-course-complete')),
  title text not null,
  description text not null,
  earned_at timestamptz not null default now(),
  unique (student_id,release_id,badge_key)
);

create index financial_literacy_badges_student_idx
  on private.financial_literacy_standard_badges(student_id,earned_at desc);

alter table public.financial_literacy_catalog_releases enable row level security;
alter table public.financial_literacy_catalog_units enable row level security;
alter table private.financial_literacy_standard_enrollments enable row level security;
alter table private.financial_literacy_standard_progress enable row level security;
alter table private.financial_literacy_standard_badges enable row level security;

revoke all on public.financial_literacy_catalog_releases from public,anon,authenticated;
revoke all on public.financial_literacy_catalog_units from public,anon,authenticated;
grant select on public.financial_literacy_catalog_releases to authenticated;
grant select on public.financial_literacy_catalog_units to authenticated;

create policy financial_literacy_catalog_releases_select
  on public.financial_literacy_catalog_releases for select to authenticated using (true);
create policy financial_literacy_catalog_units_select
  on public.financial_literacy_catalog_units for select to authenticated using (true);

revoke all on private.financial_literacy_standard_enrollments from public,anon,authenticated;
revoke all on private.financial_literacy_standard_progress from public,anon,authenticated;
revoke all on private.financial_literacy_standard_badges from public,anon,authenticated;

create or replace function private.ensure_early_prep_financial_literacy_enrollment(p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release_id text;
  v_enrollment_id uuid;
begin
  if p_student_id is null or not exists (
    select 1 from public.student_education_paths path
    where path.user_id=p_student_id and path.current_division='k12'
  ) then return null; end if;

  select release.release_id into v_release_id
  from public.financial_literacy_catalog_releases release
  where release.course_key='brexatlas.financial-literacy-course' and release.active;
  if v_release_id is null then raise exception 'No active canonical Financial Literacy release'; end if;

  insert into private.financial_literacy_standard_enrollments (
    student_id,started_release_id,current_release_id
  ) values (p_student_id,v_release_id,v_release_id)
  on conflict (student_id) do update set
    current_release_id=excluded.current_release_id,
    updated_at=case
      when private.financial_literacy_standard_enrollments.current_release_id<>excluded.current_release_id then now()
      else private.financial_literacy_standard_enrollments.updated_at
    end
  returning id into v_enrollment_id;
  return v_enrollment_id;
end;
$$;

create or replace function private.assign_financial_literacy_on_early_prep_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_division='k12' then
    perform private.ensure_early_prep_financial_literacy_enrollment(new.user_id);
  end if;
  return new;
end;
$$;

create trigger student_path_assign_financial_literacy
after insert or update of current_division on public.student_education_paths
for each row execute function private.assign_financial_literacy_on_early_prep_path();

create or replace function private.follow_active_financial_literacy_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.course_key='brexatlas.financial-literacy-course' and new.active then
    update private.financial_literacy_standard_enrollments enrollment
    set current_release_id=new.release_id,updated_at=now()
    where enrollment.current_release_id<>new.release_id;
  end if;
  return new;
end;
$$;

create trigger catalog_release_update_financial_literacy
after insert or update of active on public.financial_literacy_catalog_releases
for each row execute function private.follow_active_financial_literacy_release();

create or replace function public.get_financial_literacy_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_release public.financial_literacy_catalog_releases%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_release from public.financial_literacy_catalog_releases release
  where release.course_key='brexatlas.financial-literacy-course' and release.active;
  if not found then raise exception 'Financial Literacy catalog is unavailable'; end if;
  return jsonb_build_object(
    'release_id',v_release.release_id,'course_key',v_release.course_key,'title',v_release.title,
    'source_repository',v_release.source_repository,'source_home',v_release.source_home,
    'content_commit',v_release.content_commit,'unit_count',v_release.unit_count,
    'validated_at',v_release.validated_at,
    'units',(select jsonb_agg(jsonb_build_object(
      'unit_id',unit.unit_id,'path',unit.path,'group_number',unit.group_number,
      'group_title',unit.group_title,'title',unit.title,'position',unit.position,
      'relative_url',unit.relative_url
    ) order by unit.position) from public.financial_literacy_catalog_units unit where unit.release_id=v_release.release_id)
  );
end;
$$;

create or replace function public.get_my_financial_literacy_course()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_enrollment private.financial_literacy_standard_enrollments%rowtype;
  v_release public.financial_literacy_catalog_releases%rowtype;
  v_completed integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.student_education_paths path
    where path.user_id=v_user_id and path.current_division='k12'
  ) then return jsonb_build_object('course',null,'badges','[]'::jsonb); end if;

  perform private.ensure_early_prep_financial_literacy_enrollment(v_user_id);
  select * into v_enrollment from private.financial_literacy_standard_enrollments enrollment
  where enrollment.student_id=v_user_id;
  select * into v_release from public.financial_literacy_catalog_releases release
  where release.release_id=v_enrollment.current_release_id;
  select count(*)::integer into v_completed from private.financial_literacy_standard_progress progress
  where progress.student_id=v_user_id and progress.release_id=v_release.release_id;

  return jsonb_build_object(
    'course',jsonb_build_object(
      'enrollment_id',v_enrollment.id,'title','Financial Literacy / Personal Finance',
      'canonical_title',v_release.title,'catalog_release',v_release.release_id,
      'source_home',v_release.source_home,'source_repository',v_release.source_repository,
      'status',case when v_completed=v_release.unit_count then 'completed' when v_completed>0 then 'in_progress' else 'ready' end,
      'completed_units',v_completed,'total_units',v_release.unit_count,
      'units',(select jsonb_agg(jsonb_build_object(
        'unit_id',unit.unit_id,'path',unit.path,'group_number',unit.group_number,
        'group_title',unit.group_title,'title',unit.title,'position',unit.position,
        'relative_url',unit.relative_url,'completed',progress.unit_id is not null,
        'completed_at',progress.completed_at
      ) order by unit.position)
      from public.financial_literacy_catalog_units unit
      left join private.financial_literacy_standard_progress progress
        on progress.student_id=v_user_id and progress.release_id=unit.release_id and progress.unit_id=unit.unit_id
      where unit.release_id=v_release.release_id)
    ),
    'badges',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',badge.id,'badge_key',badge.badge_key,'title',badge.title,
      'description',badge.description,'release_id',badge.release_id,'earned_at',badge.earned_at
    ) order by badge.earned_at desc),'[]'::jsonb)
    from private.financial_literacy_standard_badges badge where badge.student_id=v_user_id)
  );
end;
$$;

create or replace function public.record_my_financial_literacy_completion(
  p_unit_id text,
  p_catalog_release text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_enrollment_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.student_education_paths path
    where path.user_id=v_user_id and path.current_division='k12'
  ) then raise exception 'Early Prep student access required'; end if;
  if p_unit_id is null or p_catalog_release is null then raise exception 'Unit and release are required'; end if;

  v_enrollment_id:=private.ensure_early_prep_financial_literacy_enrollment(v_user_id);
  if not exists (
    select 1 from private.financial_literacy_standard_enrollments enrollment
    join public.financial_literacy_catalog_units unit
      on unit.release_id=enrollment.current_release_id and unit.unit_id=p_unit_id
    where enrollment.id=v_enrollment_id and enrollment.current_release_id=p_catalog_release
  ) then raise exception 'Financial Literacy unit is not in the current Early Prep release'; end if;

  insert into private.financial_literacy_standard_progress (
    enrollment_id,student_id,release_id,unit_id,evidence_source,completed_at,updated_at
  ) values (
    v_enrollment_id,v_user_id,p_catalog_release,p_unit_id,
    'learner_confirmed_canonical_course',now(),now()
  ) on conflict (student_id,release_id,unit_id) do update set updated_at=excluded.updated_at;

  insert into public.audit_events (
    actor_id,event_type,target_type,target_id,details,event_hash
  ) values (
    v_user_id,'financial_literacy.unit_completed','financial_literacy_catalog_unit',
    p_catalog_release||':'||p_unit_id,
    jsonb_build_object('release_id',p_catalog_release,'unit_id',p_unit_id,'education_division','k12'),''
  );
  return public.get_my_financial_literacy_course();
end;
$$;

create or replace function public.get_financial_literacy_teacher_progress(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_release public.financial_literacy_catalog_releases%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not private.can_manage_course(p_course_id) or not exists (
    select 1 from public.courses course where course.id=p_course_id and course.education_division='k12'
  ) then raise exception 'Early Prep class management access required'; end if;
  select * into v_release from public.financial_literacy_catalog_releases release
  where release.course_key='brexatlas.financial-literacy-course' and release.active;
  return jsonb_build_object(
    'catalog_release',v_release.release_id,'total_units',v_release.unit_count,
    'learners',(select coalesce(jsonb_agg(jsonb_build_object(
      'student_id',profile.id,
      'display_name',coalesce(nullif(btrim(profile.full_name),''),split_part(profile.email,'@',1),'Student'),
      'completed_units',(select count(*) from private.financial_literacy_standard_progress progress
        where progress.student_id=profile.id and progress.release_id=v_release.release_id),
      'foundations_completed',(select count(*) from private.financial_literacy_standard_progress progress
        join public.financial_literacy_catalog_units unit
          on unit.release_id=progress.release_id and unit.unit_id=progress.unit_id
        where progress.student_id=profile.id and progress.release_id=v_release.release_id and unit.path='foundations'),
      'last_activity_at',(select max(progress.updated_at) from private.financial_literacy_standard_progress progress
        where progress.student_id=profile.id and progress.release_id=v_release.release_id)
    ) order by coalesce(nullif(btrim(profile.full_name),''),profile.email)),'[]'::jsonb)
    from public.course_memberships membership
    join public.profiles profile on profile.id=membership.user_id
    where membership.course_id=p_course_id and membership.role='learner'
      and private.course_membership_is_current(membership.course_id,membership.user_id,membership.role))
  );
end;
$$;

create or replace function private.issue_early_prep_financial_literacy_badges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_foundations integer;
  v_total integer;
  v_badge_id uuid;
begin
  if not exists (
    select 1 from public.student_education_paths path
    where path.user_id=new.student_id and path.current_division='k12'
  ) then return new; end if;
  select
    count(*) filter (where unit.path='foundations'),count(*)
  into v_foundations,v_total
  from private.financial_literacy_standard_progress progress
  join public.financial_literacy_catalog_units unit
    on unit.release_id=progress.release_id and unit.unit_id=progress.unit_id
  where progress.student_id=new.student_id and progress.release_id=new.release_id;

  if v_foundations=20 then
    insert into private.financial_literacy_standard_badges (
      student_id,release_id,badge_key,title,description
    ) values (
      new.student_id,new.release_id,'foundations-complete','Financial Foundations milestone',
      'Completed all 20 Financial Foundations episodes in the canonical Early Prep release.'
    ) on conflict (student_id,release_id,badge_key) do nothing returning id into v_badge_id;
    if v_badge_id is not null then
      perform private.create_student_course_notification(
        new.student_id,null,'course_completed','Financial Foundations milestone earned',
        'You completed all 20 Financial Foundations episodes. Your private milestone is ready.',
        'rewards','financial-literacy-foundations-badge:'||new.release_id
      );
    end if;
  end if;

  v_badge_id:=null;
  if v_total=40 then
    insert into private.financial_literacy_standard_badges (
      student_id,release_id,badge_key,title,description
    ) values (
      new.student_id,new.release_id,'full-course-complete','Financial Futures milestone',
      'Completed all 40 Financial Foundations and Future Wealth Quest units in the canonical Early Prep release.'
    ) on conflict (student_id,release_id,badge_key) do nothing returning id into v_badge_id;
    if v_badge_id is not null then
      perform private.create_student_course_notification(
        new.student_id,null,'course_completed','Financial Futures milestone earned',
        'You completed the full 40-unit Financial Literacy class. Your private milestone is ready.',
        'rewards','financial-literacy-full-course-badge:'||new.release_id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger financial_literacy_progress_issue_badges
after insert or update on private.financial_literacy_standard_progress
for each row execute function private.issue_early_prep_financial_literacy_badges();

select private.ensure_early_prep_financial_literacy_enrollment(path.user_id)
from public.student_education_paths path where path.current_division='k12';

revoke all on function private.ensure_early_prep_financial_literacy_enrollment(uuid) from public,anon,authenticated;
revoke all on function private.assign_financial_literacy_on_early_prep_path() from public,anon,authenticated;
revoke all on function private.follow_active_financial_literacy_release() from public,anon,authenticated;
revoke all on function private.issue_early_prep_financial_literacy_badges() from public,anon,authenticated;
revoke all on function public.get_financial_literacy_catalog() from public,anon;
revoke all on function public.get_my_financial_literacy_course() from public,anon;
revoke all on function public.record_my_financial_literacy_completion(text,text) from public,anon;
revoke all on function public.get_financial_literacy_teacher_progress(uuid) from public,anon;
grant execute on function public.get_financial_literacy_catalog() to authenticated;
grant execute on function public.get_my_financial_literacy_course() to authenticated;
grant execute on function public.record_my_financial_literacy_completion(text,text) to authenticated;
grant execute on function public.get_financial_literacy_teacher_progress(uuid) to authenticated;

comment on table public.financial_literacy_catalog_releases is
  'Governed metadata for canonical Financial Literacy releases. Content remains owned by the source repository and is never a marketplace listing.';
comment on table private.financial_literacy_standard_progress is
  'Private, student-owned Early Prep progress for canonical Financial Literacy units. No balances, account data, or financial documents are stored.';
comment on table private.financial_literacy_standard_badges is
  'Private Early Prep milestones. Separate from University course completion badges and publisher-facing records.';
