-- EdNotebook Early Prep foundation. Audience-facing language is Early Prep,
-- while the existing internal education_division identifier remains `k12`.

create table public.education_subjects (
  subject_id text primary key,
  label text not null unique,
  education_division text not null default 'k12' check (education_division='k12'),
  texas_alignment text not null,
  adapter_key text not null,
  sort_order integer not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.education_subjects(subject_id,label,texas_alignment,adapter_key,sort_order) values
  ('english-language-arts','English Language Arts','TEKS: English Language Arts and Reading','english',10),
  ('mathematics','Mathematics','TEKS: Mathematics','math',20),
  ('science','Science','TEKS: Science','science',30),
  ('social-studies-history','Social Studies / History','TEKS: Social Studies','history',40),
  ('world-languages','World Languages','TEKS: Languages Other Than English','world-languages',50),
  ('fine-arts','Fine Arts','TEKS: Fine Arts','fine-arts',60),
  ('physical-education-health','Physical Education / Health','TEKS: Health and Physical Education','health-pe',70),
  ('career-technical-education','Career and Technical Education','TEKS: Career and Technical Education','cte',80),
  ('computer-science-digital-literacy','Computer Science / Digital Literacy','TEKS: Technology Applications','digital-literacy',90),
  ('financial-literacy-personal-finance','Financial Literacy / Personal Finance','TEKS: Personal Financial Literacy','financial-literacy',100),
  ('other-approved-elective','Other Approved Elective','District-approved course standards','approved-elective',110);

alter table public.education_subjects enable row level security;
create policy education_subjects_read
on public.education_subjects for select to anon, authenticated
using (active);
grant select on public.education_subjects to anon, authenticated;

alter table public.courses
  add column subject_id text references public.education_subjects(subject_id) on delete restrict;

update public.courses
set subject_id=case
  when lower(coalesce(subject,'')) ~ 'english|language art|writing|literature' then 'english-language-arts'
  when lower(coalesce(subject,'')) ~ 'math|algebra|geometry|calculus|statistics' then 'mathematics'
  when lower(coalesce(subject,'')) ~ 'science|biology|chemistry|physics|environment' then 'science'
  when lower(coalesce(subject,'')) ~ 'history|social stud|government|geography|civics' then 'social-studies-history'
  when lower(coalesce(subject,'')) ~ 'spanish|french|language' then 'world-languages'
  when lower(coalesce(subject,'')) ~ 'art|music|theatre|dance' then 'fine-arts'
  when lower(coalesce(subject,'')) ~ 'health|physical education|wellness' then 'physical-education-health'
  when lower(coalesce(subject,'')) ~ 'career|technical|cte|trade' then 'career-technical-education'
  when lower(coalesce(subject,'')) ~ 'computer|digital|technology' then 'computer-science-digital-literacy'
  when lower(coalesce(subject,'')) ~ 'financial|personal finance|money' then 'financial-literacy-personal-finance'
  else 'other-approved-elective'
end
where education_division='k12' and subject_id is null;

create or replace function private.enforce_course_education_subject()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_label text;
begin
  if tg_op='UPDATE' and old.education_division is distinct from new.education_division then
    raise exception 'Course education division is immutable after creation';
  end if;
  if new.education_division='k12' then
    select label into v_label from public.education_subjects
    where subject_id=new.subject_id and education_division='k12' and active;
    if v_label is null then raise exception 'Early Prep courses require an approved subject ID'; end if;
    new.subject:=v_label;
  elsif new.subject_id is not null then
    raise exception 'Early Prep subject IDs cannot be assigned to university courses';
  end if;
  return new;
end;
$$;

create trigger courses_education_subject_guard
before insert or update of education_division,subject_id,subject on public.courses
for each row execute function private.enforce_course_education_subject();

alter table public.assignment_form_templates
  add column subject_id text references public.education_subjects(subject_id) on delete restrict;

update public.assignment_form_templates template
set subject_id=course.subject_id
from public.courses course
where course.id=template.course_id and course.education_division='k12' and template.subject_id is null;

create or replace function private.enforce_assignment_template_subject()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_course public.courses%rowtype;
begin
  select * into v_course from public.courses where id=new.course_id;
  if not found then raise exception 'Course not found'; end if;
  if v_course.education_division='k12' then
    new.subject_id:=coalesce(new.subject_id,v_course.subject_id);
    if not exists (select 1 from public.education_subjects s where s.subject_id=new.subject_id and s.active) then
      raise exception 'Early Prep assignment templates require an approved subject ID';
    end if;
  else
    new.subject_id:=null;
  end if;
  return new;
end;
$$;

create trigger assignment_form_templates_subject_guard
before insert or update of course_id,subject_id on public.assignment_form_templates
for each row execute function private.enforce_assignment_template_subject();

-- Division membership is evaluated from authoritative paths and reviewed
-- educator requests, not browser metadata.
create or replace function private.user_has_education_division(p_user_id uuid,p_division text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_division in ('university','k12') and (
    exists (select 1 from public.student_education_paths path where path.user_id=p_user_id and path.current_division=p_division)
    or exists (select 1 from public.identity_onboarding_requests request where request.user_id=p_user_id and request.education_division in (p_division,'both'))
    or exists (select 1 from public.educator_verification_requests request where request.user_id=p_user_id and request.education_division in (p_division,'both'))
    or exists (
      select 1 from public.course_memberships membership
      join public.courses course on course.id=membership.course_id
      where membership.user_id=p_user_id and course.education_division=p_division
    )
  );
$$;
revoke all on function private.user_has_education_division(uuid,text) from public;

-- Buying, renting, selling, seller onboarding, and refund creation fail closed
-- for Early Prep even when a client bypasses the UI.
alter table public.publisher_applications
  add column education_division text not null default 'university'
  check (education_division in ('university','k12'));

create or replace function private.enforce_early_prep_commerce_boundary()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_course_id uuid; v_application_id uuid; v_buyer_id uuid; v_order public.marketplace_orders%rowtype;
begin
  if tg_table_name='publisher_applications' then
    if new.education_division='k12'
      or (private.user_has_education_division(new.applicant_id,'k12') and not private.user_has_education_division(new.applicant_id,'university')) then
      raise exception 'Marketplace seller onboarding is unavailable in Early Prep';
    end if;
  elsif tg_table_name='published_course_directory' then
    if new.education_division='k12' and (
      new.library_access_model<>'not_listed' or new.library_price_cents is not null
      or new.library_rental_days is not null or new.library_listing_status<>'not_listed'
    ) then raise exception 'Marketplace listing is unavailable for Early Prep courses'; end if;
  elsif tg_table_name='marketplace_listings' then
    v_course_id:=new.course_id; v_application_id:=new.seller_application_id;
    if exists (select 1 from public.courses course where course.id=v_course_id and course.education_division='k12')
      or exists (select 1 from public.publisher_applications application where application.id=v_application_id and application.education_division='k12') then
      raise exception 'Marketplace listing is unavailable in Early Prep';
    end if;
  elsif tg_table_name='marketplace_orders' then
    v_course_id:=new.course_id; v_buyer_id:=new.buyer_id;
    if private.user_has_education_division(v_buyer_id,'k12') and not private.user_has_education_division(v_buyer_id,'university') then
      raise exception 'Marketplace purchases and rentals are unavailable in Early Prep';
    end if;
    if exists (select 1 from public.courses course where course.id=v_course_id and course.education_division='k12') then
      raise exception 'Marketplace purchases and rentals are unavailable for Early Prep courses';
    end if;
  elsif tg_table_name='marketplace_refund_requests' then
    select * into v_order from public.marketplace_orders where id=new.order_id;
    if private.user_has_education_division(v_order.buyer_id,'k12') and not private.user_has_education_division(v_order.buyer_id,'university') then
      raise exception 'Marketplace refunds are unavailable in Early Prep because Early Prep orders are prohibited';
    end if;
  end if;
  return new;
end;
$$;

update public.published_course_directory
set library_access_model='not_listed',library_listing_status='not_listed',
    library_price_cents=null,library_rental_days=null,library_published_at=null
where education_division='k12';

create trigger publisher_applications_early_prep_commerce_guard
before insert or update on public.publisher_applications
for each row execute function private.enforce_early_prep_commerce_boundary();
create trigger published_course_directory_early_prep_commerce_guard
before insert or update on public.published_course_directory
for each row execute function private.enforce_early_prep_commerce_boundary();
create trigger marketplace_listings_early_prep_commerce_guard
before insert or update on public.marketplace_listings
for each row execute function private.enforce_early_prep_commerce_boundary();
create trigger marketplace_orders_early_prep_commerce_guard
before insert or update on public.marketplace_orders
for each row execute function private.enforce_early_prep_commerce_boundary();
create trigger marketplace_refunds_early_prep_commerce_guard
before insert or update on public.marketplace_refund_requests
for each row execute function private.enforce_early_prep_commerce_boundary();

-- Provider-neutral crosswalk and reviewed exchange evidence. Provider secrets
-- stay in server-managed references and never enter these rows.
create table public.learning_system_crosswalks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  education_division text not null default 'k12' check (education_division='k12'),
  provider text not null check (provider in ('oneroster','powerschool','schoology')),
  record_type text not null check (record_type in ('organization','academic_session','course','class','person','enrollment','line_item','result')),
  ednotebook_record_id text not null,
  external_record_id text not null,
  source_system text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,provider,record_type,external_record_id),
  unique(institution_id,provider,record_type,ednotebook_record_id)
);

create table public.learning_system_exchange_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  course_id uuid references public.courses(id) on delete restrict,
  education_division text not null default 'k12' check (education_division='k12'),
  provider text not null check (provider in ('oneroster','powerschool','schoology')),
  direction text not null check (direction in ('import','export')),
  resource_type text not null,
  preview_hash text not null,
  idempotency_key text not null,
  review_status text not null default 'pending_review' check (review_status in ('pending_review','approved','rejected','applied','reconciled','failed')),
  preview_summary jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  applied_at timestamptz,
  reconciled_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(institution_id,provider,idempotency_key),
  check ((review_status='pending_review' and reviewed_by is null and reviewed_at is null) or review_status<>'pending_review')
);

alter table public.learning_system_crosswalks enable row level security;
alter table public.learning_system_exchange_runs enable row level security;
create policy learning_system_crosswalks_admin_read on public.learning_system_crosswalks
for select to authenticated using (private.has_platform_control_access((select auth.uid())) or private.has_institution_capability(institution_id,'view_integrations',(select auth.uid())));
create policy learning_system_exchange_runs_admin_read on public.learning_system_exchange_runs
for select to authenticated using (private.has_platform_control_access((select auth.uid())) or private.has_institution_capability(institution_id,'view_integrations',(select auth.uid())));
grant select on public.learning_system_crosswalks,public.learning_system_exchange_runs to authenticated;

-- A continuity request records an explicit, reviewed handoff. It never changes
-- the student's current division or copies protected records automatically.
create table public.education_path_transition_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_division text not null default 'k12' check (source_division='k12'),
  target_division text not null default 'university' check (target_division='university'),
  requested_manifest jsonb not null default '{}'::jsonb,
  manifest_version text not null default 'EdNotebookEducationTransition/1.0',
  status text not null default 'draft' check (status in ('draft','submitted','reviewing','approved','declined','applied','canceled')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(requested_manifest)='object')
);
alter table public.education_path_transition_requests enable row level security;
create policy education_transition_own_read on public.education_path_transition_requests
for select to authenticated using (user_id=(select auth.uid()) or private.has_platform_control_access((select auth.uid())));
create policy education_transition_own_create on public.education_path_transition_requests
for insert to authenticated with check (user_id=(select auth.uid()) and status in ('draft','submitted') and private.user_has_education_division((select auth.uid()),'k12'));
grant select,insert on public.education_path_transition_requests to authenticated;

comment on table public.education_path_transition_requests is
  'Governed request/evidence only. Applying a transition requires a later reviewed unit and never merges social audiences automatically.';
