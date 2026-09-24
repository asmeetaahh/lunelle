-- Tests for 20260913160000_forecasts_model_version.sql (G10 schema gap).
\set A '55555555-5555-5555-5555-555555555555'

-- ---- definition -----------------------------------------------------------------
do $$
declare c record;
begin
  select is_nullable, column_default, data_type
    into c
    from information_schema.columns
   where table_schema = 'public' and table_name = 'forecasts' and column_name = 'model_version';

  assert found, 'forecasts.model_version must exist';
  assert c.data_type = 'text', 'model_version must be text';
  assert c.is_nullable = 'NO', 'model_version must be NOT NULL';
  assert c.column_default is null, 'model_version must have no default (the API must supply it)';
  assert exists (select 1 from pg_constraint where conname = 'forecasts_model_version_format'),
    'format CHECK must exist';
end $$;

-- ---- behaviour ------------------------------------------------------------------
insert into auth.users (id, email) values (:'A', 'a3@test.local');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', false) \gset

do $$ begin
  -- omitted → rejected
  begin
    insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis)
      values ('2026-10-01', '2026-10-05', '2026-10-03', 2, 'observed_cycle');
    raise exception 'FAIL: snapshot accepted without model_version';
  exception when not_null_violation then null; end;

  -- empty / malformed → rejected
  begin
    insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
      values ('2026-10-01', '2026-10-05', '2026-10-03', 2, 'observed_cycle', '');
    raise exception 'FAIL: empty model_version accepted';
  exception when check_violation then null; end;
  begin
    insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
      values ('2026-10-01', '2026-10-05', '2026-10-03', 2, 'observed_cycle', 'Cycle Engine v1');
    raise exception 'FAIL: model_version with spaces/uppercase accepted';
  exception when check_violation then null; end;
  begin
    insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
      values ('2026-10-01', '2026-10-05', '2026-10-03', 2, 'observed_cycle', repeat('a', 41));
    raise exception 'FAIL: 41-char model_version accepted';
  exception when check_violation then null; end;
end $$;

-- valid → stored, and still owner-scoped by RLS
insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
  values ('2026-10-01', '2026-10-05', '2026-10-03', 2, 'observed_cycle', 'cycle-1');
do $$ begin
  assert (select model_version from public.forecasts) = 'cycle-1', 'valid model_version stored';
  assert (select user_id from public.forecasts) = '55555555-5555-5555-5555-555555555555', 'snapshot owned by caller';
end $$;
reset role;

-- cleanup
delete from auth.users where id = :'A';
\echo '   PASS 03_forecasts_model_version'
