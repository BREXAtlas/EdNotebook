-- Run only on a disposable Supabase database after every repository migration.
-- Reproduces the PostgREST INSERT ... RETURNING path used when a student or
-- professor opens Campus Social for the first time.

begin;
set local statement_timeout = '30s';

insert into auth.users (
  id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '10000000-0000-4000-8000-000000000099',
  'authenticated',
  'authenticated',
  'campus-social-returning@safety.invalid',
  'not-a-login',
  now(),
  '{}',
  '{"full_name":"Campus Social Returning","requested_role":"learner","affiliation_choice":"independent"}',
  now(),
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000099',
  true
);
set local role authenticated;

insert into public.campus_social_profiles (
  user_id,account_type,education_division,institution_name,
  display_name,visibility,discoverable
) values (
  '10000000-0000-4000-8000-000000000099',
  'student',
  'university',
  'Independent',
  'Campus Social Returning',
  'public_university',
  true
)
returning user_id,display_name,visibility;

insert into public.campus_social_posts (
  author_id,audience,body
) values (
  '10000000-0000-4000-8000-000000000099',
  'public_university',
  'Campus Social post returning gate'
)
returning id,author_id,audience,body;

rollback;
