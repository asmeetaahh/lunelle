-- Minimal stand-in for the parts of Supabase's `auth` schema the migrations
-- and tests touch. Only used in the harness's throwaway database.
create schema auth;

create table auth.users (
  id    uuid primary key,
  email text
);

-- Same expression Supabase ships: sub from the JWT claims of the current request.
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
