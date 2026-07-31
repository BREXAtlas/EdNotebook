-- A commercial EduBook can offer permanent purchase and time-limited rental
-- at the same time. The governed marketplace listing is the authority for
-- each paid access option; publications.access_model remains the authoring
-- default and must not hide another approved listing from the catalog.
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
  checkout_available boolean,
  marketplace_listing_id uuid,
  currency text
)
language sql
stable
security definer
set search_path=''
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
      coalesce(listing.price_cents,directory.library_price_cents) as price_cents,
      coalesce(listing.rental_days,directory.library_rental_days) as rental_days,
      directory.enrollment_policy,
      directory.universal_assignment,
      directory.education_division,
      coalesce(listing.published_at,directory.library_published_at,directory.published_at) as published_at,
      coalesce(private.marketplace_listing_is_ready(listing.id),false) as checkout_available,
      listing.id as marketplace_listing_id,
      coalesce(listing.currency,'usd') as currency
    from public.published_course_directory directory
    join public.course_publications course_publication
      on course_publication.course_id=directory.course_id
     and course_publication.status='published'
    left join public.marketplace_listings listing
      on listing.course_id=directory.course_id
     and listing.access_model=directory.library_access_model
     and listing.status='published'
    where directory.is_listed
      and directory.library_listing_status in ('published','review')
      and (
        directory.library_access_model='open_free'
        or listing.id is not null
        or directory.library_listing_status='review'
      )

    union all

    select
      'book'::text,
      publication.id,
      publication.course_id,
      null::uuid,
      publication.title,
      coalesce(nullif(publication.author_name,''),'Professor author'),
      publication.description,
      coalesce(listing.access_model,publication.access_model),
      case when publication.status='review' then 'review' else 'published' end,
      publication.reading_mode,
      coalesce(listing.price_cents,publication.price_cents),
      coalesce(listing.rental_days,publication.rental_days),
      null::text,
      false,
      coalesce(course.education_division,'university'),
      coalesce(listing.published_at,publication.published_at,publication.created_at),
      coalesce(private.marketplace_listing_is_ready(listing.id),false),
      listing.id,
      coalesce(listing.currency,'usd')
    from public.publications publication
    left join public.courses course on course.id=publication.course_id
    left join public.marketplace_listings listing
      on listing.publication_id=publication.id
     and listing.status='published'
    where publication.status in ('published','review')
      and publication.access_model in ('open','purchase','rental')
      and (
        publication.access_model='open'
        or listing.id is not null
        or publication.status='review'
      )
  ) catalog
  where coalesce(nullif(trim(p_query),''),'')=''
     or concat_ws(
       ' ',catalog.title,catalog.creator_name,catalog.description,catalog.item_kind
     ) ilike '%'||trim(p_query)||'%'
  order by catalog.published_at desc nulls last,catalog.title
  limit 100;
$$;

revoke all on function public.list_alex_morrison_catalog(text) from public;
grant execute on function public.list_alex_morrison_catalog(text) to anon,authenticated;
