-- Connect professor-published courses and books to the Alex B. Morrison
-- Library/Bookstore without duplicating course packages or publication sources.
-- Commercial listings remain review-only until governed checkout is activated.

alter table public.published_course_directory
  add column if not exists library_access_model text not null default 'not_listed'
    check (library_access_model in ('not_listed','open_free','purchase','rental')),
  add column if not exists library_listing_status text not null default 'not_listed'
    check (library_listing_status in ('not_listed','published','review','suspended')),
  add column if not exists library_price_cents integer
    check (library_price_cents is null or library_price_cents > 0),
  add column if not exists library_rental_days integer
    check (library_rental_days is null or library_rental_days between 1 and 365),
  add column if not exists library_published_at timestamptz;

alter table public.published_course_directory
  drop constraint if exists published_course_directory_library_access_check;
alter table public.published_course_directory
  add constraint published_course_directory_library_access_check
  check (
    (library_access_model in ('not_listed','open_free')
      and library_price_cents is null
      and library_rental_days is null)
    or
    (library_access_model='purchase'
      and library_price_cents is not null
      and library_rental_days is null)
    or
    (library_access_model='rental'
      and library_price_cents is not null
      and library_rental_days is not null)
  );

alter table public.published_course_directory
  drop constraint if exists published_course_directory_library_status_check;
alter table public.published_course_directory
  add constraint published_course_directory_library_status_check
  check (
    (library_access_model='not_listed' and library_listing_status='not_listed')
    or
    (library_access_model='open_free' and library_listing_status in ('published','suspended'))
    or
    (library_access_model in ('purchase','rental') and library_listing_status in ('review','suspended'))
  );

create index if not exists published_course_directory_library_idx
  on public.published_course_directory
  (library_listing_status,library_access_model,library_published_at desc);

alter table public.publications
  add column if not exists reading_mode text not null default 'interactive'
    check (reading_mode in ('read_only','interactive')),
  add column if not exists published_at timestamptz;

create index if not exists publications_catalog_idx
  on public.publications (status,access_model,published_at desc);

drop policy if exists publications_select on public.publications;
create policy publications_select
on public.publications for select to authenticated
using (
  owner_id=(select auth.uid())
  or private.is_platform_manager()
  or (
    status='published'
    and access_model='open'
  )
  or (
    status='published'
    and access_model='assigned'
    and course_id is not null
    and private.can_access_course(course_id)
  )
);

drop policy if exists publications_update on public.publications;
create policy publications_update
on public.publications for update to authenticated
using (
  owner_id=(select auth.uid())
  or private.is_platform_manager()
)
with check (
  (
    owner_id=(select auth.uid())
    or private.is_platform_manager()
  )
  and (
    course_id is null
    or private.can_manage_course(course_id)
  )
);

create or replace function private.enforce_publication_release()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('review','approved','published')
     and not new.rights_confirmed then
    raise exception 'Publication rights must be confirmed before review or release';
  end if;
  if new.status='published'
     and new.access_model in ('open','assigned')
     and new.conversion_status<>'ready' then
    raise exception 'Publication conversion must be ready before release';
  end if;
  if new.access_model='assigned' and new.course_id is null then
    raise exception 'Assigned publication requires a course';
  end if;
  if new.access_model in ('purchase','rental')
     and new.status='published' then
    raise exception 'Commercial publication checkout is not active';
  end if;
  if new.access_model in ('purchase','rental')
     and new.status in ('review','approved')
     and coalesce(new.price_cents,0)<=0 then
    raise exception 'Commercial publication review requires a price';
  end if;
  if new.access_model='rental'
     and new.status in ('review','approved')
     and coalesce(new.rental_days,0) not between 1 and 365 then
    raise exception 'Rental publication review requires 1 to 365 rental days';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_publication_release()
from public,anon,authenticated;

drop trigger if exists publications_release_guard on public.publications;
create trigger publications_release_guard
before insert or update of
  course_id,rights_confirmed,conversion_status,access_model,price_cents,
  rental_days,status
on public.publications
for each row execute function private.enforce_publication_release();

create or replace function public.set_course_library_listing(
  p_course_id uuid,
  p_access_model text,
  p_price_cents integer default null,
  p_rental_days integer default null
)
returns public.published_course_directory
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directory public.published_course_directory%rowtype;
begin
  if (select auth.uid()) is null
     or not private.can_manage_course(p_course_id) then
    raise exception 'Course library access denied';
  end if;
  if p_access_model not in ('not_listed','open_free','purchase','rental') then
    raise exception 'Choose not listed, free, purchase, or rental';
  end if;
  if not exists (
    select 1
    from public.course_publications publication
    join public.courses course on course.id=publication.course_id
    where publication.course_id=p_course_id
      and publication.status='published'
      and course.status='published'
  ) then
    raise exception 'Publish the approved course package before listing it in the library';
  end if;
  if p_access_model in ('purchase','rental')
     and coalesce(p_price_cents,0)<=0 then
    raise exception 'Commercial listings require a price';
  end if;
  if p_access_model='rental'
     and coalesce(p_rental_days,0) not between 1 and 365 then
    raise exception 'Rental listings require 1 to 365 rental days';
  end if;

  update public.published_course_directory
  set library_access_model=p_access_model,
      library_listing_status=case
        when p_access_model='not_listed' then 'not_listed'
        when p_access_model='open_free' then 'published'
        else 'review'
      end,
      library_price_cents=case
        when p_access_model in ('purchase','rental') then p_price_cents
        else null
      end,
      library_rental_days=case
        when p_access_model='rental' then p_rental_days
        else null
      end,
      library_published_at=case
        when p_access_model='not_listed' then null
        else coalesce(library_published_at,now())
      end,
      updated_at=now()
  where course_id=p_course_id
  returning * into v_directory;

  if not found then
    raise exception 'Published course directory entry not found';
  end if;
  return v_directory;
end;
$$;

create or replace function public.set_publication_library_access(
  p_publication_id uuid,
  p_access_model text,
  p_reading_mode text,
  p_course_id uuid default null,
  p_price_cents integer default null,
  p_rental_days integer default null
)
returns public.publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication public.publications%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  select * into v_publication
  from public.publications
  where id=p_publication_id
  for update;
  if not found
     or (
       v_publication.owner_id<>(select auth.uid())
       and not private.is_platform_manager()
     ) then
    raise exception 'Publication access denied';
  end if;
  if p_access_model not in ('private','assigned','open','purchase','rental') then
    raise exception 'Choose private, assigned, open, purchase, or rental access';
  end if;
  if p_reading_mode not in ('read_only','interactive') then
    raise exception 'Choose read-only or interactive EduBook mode';
  end if;
  if not v_publication.rights_confirmed then
    raise exception 'Confirm publication rights before release';
  end if;
  if p_access_model<>'private'
     and v_publication.conversion_status<>'ready' then
    raise exception 'Publication conversion must be ready before release';
  end if;
  if p_course_id is not null
     and not private.can_manage_course(p_course_id) then
    raise exception 'Course link access denied';
  end if;
  if p_access_model='assigned' and p_course_id is null then
    raise exception 'Assigned reading requires a course';
  end if;
  if p_access_model in ('purchase','rental')
     and coalesce(p_price_cents,0)<=0 then
    raise exception 'Commercial listings require a price';
  end if;
  if p_access_model='rental'
     and coalesce(p_rental_days,0) not between 1 and 365 then
    raise exception 'Rental listings require 1 to 365 rental days';
  end if;

  update public.publications
  set course_id=p_course_id,
      access_model=p_access_model,
      reading_mode=p_reading_mode,
      price_cents=case
        when p_access_model in ('purchase','rental') then p_price_cents
        else null
      end,
      rental_days=case
        when p_access_model='rental' then p_rental_days
        else null
      end,
      status=case
        when p_access_model='private' then 'draft'
        when p_access_model in ('assigned','open') then 'published'
        else 'review'
      end,
      published_at=case
        when p_access_model='private' then null
        else coalesce(published_at,now())
      end,
      updated_at=now()
  where id=p_publication_id
  returning * into v_publication;

  return v_publication;
end;
$$;

create or replace function public.list_alex_morrison_catalog(
  p_query text default ''
)
returns table (
  item_kind text,
  item_id uuid,
  course_id uuid,
  course_publication_id uuid,
  title text,
  creator_name text,
  description text,
  access_model text,
  listing_status text,
  reading_mode text,
  price_cents integer,
  rental_days integer,
  enrollment_policy text,
  universal_assignment boolean,
  education_division text,
  published_at timestamptz,
  checkout_available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select catalog.*
  from (
    select
      'course'::text as item_kind,
      directory.course_id as item_id,
      directory.course_id,
      course_publication.id as course_publication_id,
      directory.title,
      directory.professor_display_name as creator_name,
      coalesce(directory.summary,'') as description,
      directory.library_access_model as access_model,
      directory.library_listing_status as listing_status,
      'interactive'::text as reading_mode,
      directory.library_price_cents as price_cents,
      directory.library_rental_days as rental_days,
      directory.enrollment_policy,
      directory.universal_assignment,
      directory.education_division,
      coalesce(directory.library_published_at,directory.published_at) as published_at,
      false as checkout_available
    from public.published_course_directory directory
    join public.course_publications course_publication
      on course_publication.course_id=directory.course_id
     and course_publication.status='published'
    where directory.is_listed
      and directory.library_listing_status in ('published','review')

    union all

    select
      'book'::text as item_kind,
      publication.id as item_id,
      publication.course_id,
      null::uuid as course_publication_id,
      publication.title,
      coalesce(nullif(publication.author_name,''),'Professor author') as creator_name,
      publication.description,
      publication.access_model,
      case when publication.status='review' then 'review' else 'published' end,
      publication.reading_mode,
      publication.price_cents,
      publication.rental_days,
      null::text as enrollment_policy,
      false as universal_assignment,
      coalesce(course.education_division,'university') as education_division,
      coalesce(publication.published_at,publication.created_at) as published_at,
      false as checkout_available
    from public.publications publication
    left join public.courses course on course.id=publication.course_id
    where publication.status in ('published','review')
      and publication.access_model in ('open','purchase','rental')
  ) catalog
  where coalesce(nullif(trim(p_query),''),'')=''
     or concat_ws(
       ' ',
       catalog.title,
       catalog.creator_name,
       catalog.description,
       catalog.item_kind
     ) ilike '%' || trim(p_query) || '%'
  order by catalog.published_at desc nulls last,catalog.title
  limit 100;
$$;

revoke all on function public.set_course_library_listing(uuid,text,integer,integer)
from public,anon;
revoke all on function public.set_publication_library_access(uuid,text,text,uuid,integer,integer)
from public,anon;
revoke all on function public.list_alex_morrison_catalog(text)
from public;

grant execute on function public.set_course_library_listing(uuid,text,integer,integer)
to authenticated;
grant execute on function public.set_publication_library_access(uuid,text,text,uuid,integer,integer)
to authenticated;
grant execute on function public.list_alex_morrison_catalog(text)
to anon,authenticated;

-- Digital Literacy is the free pilot/library example. Enrollment and universal
-- assignment remain separate professor-controlled choices.
update public.published_course_directory directory
set library_access_model='open_free',
    library_listing_status='published',
    library_price_cents=null,
    library_rental_days=null,
    library_published_at=coalesce(directory.library_published_at,now()),
    enrollment_policy='open_self_enroll',
    updated_at=now()
where directory.is_listed
  and lower(directory.title) like 'digital literacy%'
  and exists (
    select 1
    from public.course_publications publication
    where publication.course_id=directory.course_id
      and publication.status='published'
  );
