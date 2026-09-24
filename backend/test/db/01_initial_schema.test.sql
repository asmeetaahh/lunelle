-- Tests for 20260913140000_v2_initial_schema.sql: RLS, grants, constraints, triggers.
-- Runs as a superuser and switches role to simulate PostgREST callers.
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- ---- structure ---------------------------------------------------------------
do $$ begin
  assert (select count(*) from pg_class
          where relnamespace = 'public'::regnamespace and relkind = 'r'
            and relrowsecurity and relforcerowsecurity) = 8,
    'all 8 tables must have RLS enabled and forced';
  assert (select count(*) from pg_policies where schemaname = 'public' and tablename <> 'subscription_state') = 28,
    '7 user-owned tables x 4 policies';
  assert (select count(*) from pg_policies where schemaname = 'public' and tablename = 'subscription_state') = 1,
    'subscription_state has exactly one (select) policy';
  assert not exists (select 1 from information_schema.role_table_grants
                     where table_schema = 'public' and grantee = 'anon'),
    'anon must have no table grants';
  assert (select string_agg(privilege_type, ',' order by privilege_type)
          from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'subscription_state' and grantee = 'authenticated') = 'SELECT',
    'authenticated may only SELECT subscription_state';
end $$;

-- ---- signup trigger ------------------------------------------------------------
insert into auth.users (id, email) values (:'A', 'a@test.local'), (:'B', 'b@test.local');
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'trigger should create 2 profiles';
  assert (select count(*) from public.subscription_state where is_plus = false) = 2, 'trigger should create 2 subscription rows';
end $$;

-- ---- act as user A -------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false) \gset

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A sees exactly own profile';
  assert (select id from public.profiles) = '11111111-1111-1111-1111-111111111111', 'A sees A';
end $$;

insert into public.cycle_events (type, date) values ('period_start', '2026-08-14');
insert into public.cycle_settings (reported_cycle_length, reported_period_length) values (28, 5);
insert into public.daily_observations (date, mood, energy, symptoms, note) values ('2026-09-01', 3, 4, '{cramps,fatigue}', 'ok');
insert into public.journal_entries (body) values ('hello');
insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
  values ('2026-09-09', '2026-09-13', '2026-09-11', 2, 'observed_cycle', 'cycle-1');
insert into public.pattern_evidence (pattern_type, signal, phase, confidence_tier, supporting_cycles, assessable_cycles, consistency)
  values ('symptom', 'cramps', 'luteal', 'emerging', 2, 3, 0.667);

do $$ begin
  assert (select bool_and(user_id = '11111111-1111-1111-1111-111111111111') from public.cycle_events), 'user_id defaulted to auth.uid()';
end $$;

-- identity cannot be spoofed
do $$ begin
  begin
    insert into public.cycle_events (user_id, type, date) values ('22222222-2222-2222-2222-222222222222', 'period_start', '2026-08-01');
    raise exception 'FAIL: inserted row for another user';
  exception when insufficient_privilege then null; end;
  begin
    update public.cycle_events set user_id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: reassigned row to another user';
  exception when insufficient_privilege then null; end;
end $$;

-- subscription_state is read-only for users
do $$ begin
  assert (select count(*) from public.subscription_state) = 1, 'A sees one subscription row';
  begin update public.subscription_state set is_plus = true; raise exception 'FAIL: user updated subscription_state';
  exception when insufficient_privilege then null; end;
  begin insert into public.subscription_state (user_id, is_plus) values ('11111111-1111-1111-1111-111111111111', true); raise exception 'FAIL: user inserted subscription_state';
  exception when insufficient_privilege then null; end;
  begin delete from public.subscription_state; raise exception 'FAIL: user deleted subscription_state';
  exception when insufficient_privilege then null; end;
end $$;

-- SECURITY DEFINER bootstrap is not callable through the API
do $$ begin
  begin perform public.handle_new_auth_user(); raise exception 'FAIL: called handle_new_auth_user';
  exception when insufficient_privilege then null; end;
end $$;

-- CHECK constraints
do $$ begin
  begin insert into public.daily_observations (date, mood) values ('2026-09-02', 6); raise exception 'FAIL: mood 6 accepted';
  exception when check_violation then null; end;
  begin insert into public.daily_observations (date, energy) values ('2026-09-02', 0); raise exception 'FAIL: energy 0 accepted';
  exception when check_violation then null; end;
  begin insert into public.daily_observations (date, symptoms) values ('2026-09-02', '{unicorns}'); raise exception 'FAIL: unknown symptom accepted';
  exception when check_violation then null; end;
  begin insert into public.daily_observations (date, symptoms) values ('2026-09-02', '{cramps,cramps}'); raise exception 'FAIL: duplicate symptoms accepted';
  exception when check_violation then null; end;
  begin insert into public.daily_observations (date, mood) values ('2026-09-01', 2); raise exception 'FAIL: second observation same day accepted';
  exception when unique_violation then null; end;
  begin update public.cycle_settings set reported_cycle_length = 14; raise exception 'FAIL: cycle length 14 accepted';
  exception when check_violation then null; end;
  begin update public.cycle_settings set reported_cycle_length = 61; raise exception 'FAIL: cycle length 61 accepted';
  exception when check_violation then null; end;
  begin insert into public.cycle_events (type, date) values ('ovulation', '2026-08-20'); raise exception 'FAIL: bad event type accepted';
  exception when check_violation then null; end;
  begin insert into public.cycle_events (type, date) values ('period_start', '2026-08-14'); raise exception 'FAIL: duplicate event accepted';
  exception when unique_violation then null; end;
  begin insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
    values ('2026-09-09', '2026-09-13', '2026-09-11', 2, 'guess', 'cycle-1'); raise exception 'FAIL: bad basis accepted';
  exception when check_violation then null; end;
  begin insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
    values ('2026-09-12', '2026-09-13', '2026-09-11', 2, 'calibrated', 'cycle-1'); raise exception 'FAIL: expected outside window accepted';
  exception when check_violation then null; end;
  begin insert into public.pattern_evidence (pattern_type, signal, confidence_tier, supporting_cycles, assessable_cycles, consistency)
    values ('symptom', 'headache', 'none', 1, 3, 0.333); raise exception 'FAIL: tier none accepted';
  exception when check_violation then null; end;
  begin insert into public.pattern_evidence (pattern_type, signal, confidence_tier, supporting_cycles, assessable_cycles, consistency)
    values ('symptom', 'headache', 'likely', 4, 3, 1); raise exception 'FAIL: supporting > assessable accepted';
  exception when check_violation then null; end;
end $$;

-- updated_at is stamped by the trigger, not the client
do $$ declare before_ts timestamptz; after_ts timestamptz; begin
  select updated_at into before_ts from public.journal_entries;
  perform pg_sleep(0.01);
  update public.journal_entries set body = 'edited', updated_at = '2000-01-01';
  select updated_at into after_ts from public.journal_entries;
  assert after_ts > before_ts, 'updated_at should be stamped by trigger';
end $$;

-- ---- act as user B: sees none of A's data --------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false) \gset
do $$ begin
  assert (select count(*) from public.cycle_events) = 0, 'B sees no cycle_events';
  assert (select count(*) from public.daily_observations) = 0, 'B sees no observations';
  assert (select count(*) from public.journal_entries) = 0, 'B sees no journal';
  assert (select count(*) from public.forecasts) = 0, 'B sees no forecasts';
  assert (select count(*) from public.pattern_evidence) = 0, 'B sees no patterns';
  assert (select count(*) from public.cycle_settings) = 0, 'B sees no settings';
  assert (select user_id from public.subscription_state) = '22222222-2222-2222-2222-222222222222', 'B sees own subscription only';
  update public.journal_entries set body = 'hacked';
  delete from public.cycle_events;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.cycle_events) = 1, 'A rows survived B delete attempt';
  assert (select count(*) from public.journal_entries where body = 'hacked') = 0, 'A rows survived B update attempt';
end $$;

-- ---- anon: no access ----------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false) \gset
do $$ begin
  begin perform * from public.profiles; raise exception 'FAIL: anon read profiles';
  exception when insufficient_privilege then null; end;
  begin perform * from public.daily_observations; raise exception 'FAIL: anon read observations';
  exception when insufficient_privilege then null; end;
  begin perform * from public.subscription_state; raise exception 'FAIL: anon read subscription_state';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---- service_role (future RevenueCat webhook) ---------------------------------
set role service_role;
update public.subscription_state set is_plus = true, entitlement = 'plus' where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  assert (select is_plus from public.subscription_state where user_id = '11111111-1111-1111-1111-111111111111'), 'service_role updated entitlement';
end $$;
reset role;

-- ---- cascade delete -----------------------------------------------------------
delete from auth.users where id = :'A';
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A profile cascaded';
  assert (select count(*) from public.cycle_events) = 0, 'A events cascaded';
  assert (select count(*) from public.subscription_state) = 1, 'A subscription cascaded';
end $$;

-- cleanup
delete from auth.users where id = :'B';
\echo '   PASS 01_initial_schema'
