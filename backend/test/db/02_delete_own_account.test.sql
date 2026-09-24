-- Tests for 20260913150000_delete_own_account.sql (G1).
\set A '33333333-3333-3333-3333-333333333333'
\set B '44444444-4444-4444-4444-444444444444'

-- ---- definition -----------------------------------------------------------------
do $$
declare f record;
begin
  select p.prosecdef, p.proconfig, p.proacl, p.pronargs
    into f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'delete_own_account';

  assert found, 'public.delete_own_account must exist';
  assert f.prosecdef, 'must be SECURITY DEFINER';
  assert f.pronargs = 0, 'must take no arguments (the target is always auth.uid())';
  assert 'search_path=""' = any(f.proconfig), 'must set an empty search_path';

  assert has_function_privilege('authenticated', 'public.delete_own_account()', 'EXECUTE'),
    'authenticated must be able to execute';
  assert not has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE'),
    'anon must not be able to execute';
  assert not has_function_privilege('service_role', 'public.delete_own_account()', 'EXECUTE'),
    'service_role must not be granted execute';
  -- A PUBLIC grant shows up as an ACL item with an empty grantee: "=X/owner".
  assert not exists (select 1 from unnest(coalesce(f.proacl, '{}'::aclitem[])) a where a::text like '=%'),
    'PUBLIC must not have execute';
end $$;

-- ---- behaviour ------------------------------------------------------------------
insert into auth.users (id, email) values (:'A', 'a2@test.local'), (:'B', 'b2@test.local');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \gset
insert into public.cycle_events (type, date) values ('period_start', '2026-08-01');
insert into public.journal_entries (body) values ('mine');
reset role;

-- anon cannot call it
set role anon;
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  begin perform public.delete_own_account(); raise exception 'FAIL: anon executed delete_own_account';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- service_role cannot call it (it has other means; the function is not one of them)
set role service_role;
do $$ begin
  begin perform public.delete_own_account(); raise exception 'FAIL: service_role executed delete_own_account';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- authenticated without an identity: refuses, deletes nothing
set role authenticated;
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  begin perform public.delete_own_account(); raise exception 'FAIL: ran without auth.uid()';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from auth.users where id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')) = 2,
    'no user deleted without identity';
end $$;

-- user A deletes themselves: only A and A's rows disappear
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \gset
do $$ begin perform public.delete_own_account(); end $$;
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '33333333-3333-3333-3333-333333333333'), 'A removed from auth.users';
  assert exists (select 1 from auth.users where id = '44444444-4444-4444-4444-444444444444'), 'B untouched';
  assert not exists (select 1 from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 'A profile cascaded';
  assert not exists (select 1 from public.cycle_events where user_id = '33333333-3333-3333-3333-333333333333'), 'A events cascaded';
  assert not exists (select 1 from public.journal_entries where user_id = '33333333-3333-3333-3333-333333333333'), 'A journal cascaded';
  assert not exists (select 1 from public.subscription_state where user_id = '33333333-3333-3333-3333-333333333333'), 'A subscription cascaded';
  assert exists (select 1 from public.profiles where id = '44444444-4444-4444-4444-444444444444'), 'B profile untouched';
end $$;

-- a still-valid token for an already-deleted user is a harmless no-op
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false) \gset
do $$ begin perform public.delete_own_account(); end $$;
reset role;
do $$ begin
  assert exists (select 1 from auth.users where id = '44444444-4444-4444-4444-444444444444'), 'B still untouched after repeat call';
end $$;

-- cleanup
delete from auth.users where id = :'B';
\echo '   PASS 02_delete_own_account'
