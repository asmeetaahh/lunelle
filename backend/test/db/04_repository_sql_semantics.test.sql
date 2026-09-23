-- Proves, at the SQL level, the semantics the repositories rely on when they
-- issue PostgREST upserts without a user_id in the payload:
--   * user_id DEFAULT auth.uid() stamps the row from the JWT
--   * ON CONFLICT (…) DO UPDATE SET <payload columns> merges: omitted columns
--     stay unchanged, explicit NULL clears
--   * one user's upsert can never touch another user's row
\set A '66666666-6666-6666-6666-666666666666'
\set B '77777777-7777-7777-7777-777777777777'

insert into auth.users (id, email) values (:'A', 'a4@test.local'), (:'B', 'b4@test.local');

-- ---- user A -------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', false) \gset

-- cycle_settings: upsert on user_id with partial payloads (what cycleSettings.upsert sends)
insert into public.cycle_settings (reported_cycle_length) values (28)
  on conflict (user_id) do update set reported_cycle_length = excluded.reported_cycle_length;
insert into public.cycle_settings (reported_period_length) values (5)
  on conflict (user_id) do update set reported_period_length = excluded.reported_period_length;
do $$ begin
  assert (select count(*) from public.cycle_settings) = 1, 'still one settings row';
  assert (select reported_cycle_length from public.cycle_settings) = 28, 'omitted column unchanged by second upsert';
  assert (select reported_period_length from public.cycle_settings) = 5, 'second upsert applied';
end $$;
insert into public.cycle_settings (reported_cycle_length) values (null)
  on conflict (user_id) do update set reported_cycle_length = excluded.reported_cycle_length;
do $$ begin
  assert (select reported_cycle_length from public.cycle_settings) is null, 'explicit null clears';
  assert (select reported_period_length from public.cycle_settings) = 5, 'sibling column untouched';
end $$;

-- daily_observations: upsert on (user_id, date) — what observations.upsertForDate sends
insert into public.daily_observations (date, mood, symptoms) values ('2026-09-01', 3, '{cramps}')
  on conflict (user_id, date) do update set mood = excluded.mood, symptoms = excluded.symptoms;
insert into public.daily_observations (date, note) values ('2026-09-01', 'tired')
  on conflict (user_id, date) do update set note = excluded.note;
do $$ declare r record; begin
  select * into r from public.daily_observations where date = '2026-09-01';
  assert (select count(*) from public.daily_observations) = 1, 'one observation per day';
  assert r.mood = 3 and r.symptoms = '{cramps}'::text[] and r.note = 'tired', 'merge kept earlier columns';
  assert r.updated_at >= r.created_at, 'updated_at stamped';
end $$;
insert into public.daily_observations (date, mood) values ('2026-09-01', null)
  on conflict (user_id, date) do update set mood = excluded.mood;
do $$ begin
  assert (select mood from public.daily_observations where date = '2026-09-01') is null, 'null clears mood';
  assert (select note from public.daily_observations where date = '2026-09-01') = 'tired', 'note untouched';
end $$;
-- a bare payload (only the date) creates the day with defaults
insert into public.daily_observations (date) values ('2026-09-02') on conflict (user_id, date) do nothing;
do $$ begin
  assert (select symptoms from public.daily_observations where date = '2026-09-02') = '{}'::text[], 'symptoms default {}';
end $$;

-- pattern_evidence: upsert on (user_id, pattern_type, signal) — what patternEvidence.upsert sends
insert into public.pattern_evidence (pattern_type, signal, phase, confidence_tier, supporting_cycles, assessable_cycles, consistency, evidence, range_start, range_end, computed_at)
  values ('symptom', 'cramps', 'luteal', 'emerging', 2, 4, 0.5, '[]', null, null, '2026-09-01T00:00:00Z')
  on conflict (user_id, pattern_type, signal) do update set
    phase = excluded.phase, confidence_tier = excluded.confidence_tier, supporting_cycles = excluded.supporting_cycles,
    assessable_cycles = excluded.assessable_cycles, consistency = excluded.consistency, evidence = excluded.evidence,
    range_start = excluded.range_start, range_end = excluded.range_end, computed_at = excluded.computed_at;
insert into public.pattern_evidence (pattern_type, signal, phase, confidence_tier, supporting_cycles, assessable_cycles, consistency, evidence, range_start, range_end, computed_at)
  values ('symptom', 'cramps', 'luteal', 'likely', 3, 5, 0.6, '[{"cycleIndex":0}]', '2026-06-20', '2026-09-01', '2026-09-13T00:00:00Z')
  on conflict (user_id, pattern_type, signal) do update set
    phase = excluded.phase, confidence_tier = excluded.confidence_tier, supporting_cycles = excluded.supporting_cycles,
    assessable_cycles = excluded.assessable_cycles, consistency = excluded.consistency, evidence = excluded.evidence,
    range_start = excluded.range_start, range_end = excluded.range_end, computed_at = excluded.computed_at;
do $$ declare r record; begin
  select * into r from public.pattern_evidence where pattern_type = 'symptom' and signal = 'cramps';
  assert (select count(*) from public.pattern_evidence) = 1, 'one row per pattern';
  assert r.confidence_tier = 'likely' and r.supporting_cycles = 3 and r.consistency = 0.600, 'replaced by recompute';
  assert r.computed_at = '2026-09-13T00:00:00Z'::timestamptz, 'computed_at refreshed because it was in the payload';
end $$;

-- forecasts: append-only inserts without user_id; ordering by generated_at picks the newest
insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
  values ('2026-09-09', '2026-09-13', '2026-09-11', 2, 'observed_cycle', 'cycle-1');
select pg_sleep(0.01) \gset
insert into public.forecasts (window_start, window_end, expected_period_date, period_uncertainty_days, basis, model_version)
  values ('2026-09-10', '2026-09-14', '2026-09-12', 2, 'observed_cycle', 'cycle-1');
do $$ begin
  assert (select expected_period_date from public.forecasts order by generated_at desc limit 1) = '2026-09-12', 'latest = newest generated_at';
  assert (select count(*) from public.forecasts) = 2, 'older snapshot retained';
end $$;

-- ---- user B: upserts land on B's own rows, never A's -----------------------------
select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', false) \gset
insert into public.cycle_settings (reported_cycle_length) values (31)
  on conflict (user_id) do update set reported_cycle_length = excluded.reported_cycle_length;
insert into public.daily_observations (date, mood) values ('2026-09-01', 5)
  on conflict (user_id, date) do update set mood = excluded.mood;
reset role;
do $$ begin
  assert (select count(*) from public.cycle_settings) = 2, 'B got a separate settings row';
  assert (select reported_cycle_length from public.cycle_settings where user_id = '66666666-6666-6666-6666-666666666666') is null, 'A settings untouched';
  assert (select mood from public.daily_observations where user_id = '66666666-6666-6666-6666-666666666666' and date = '2026-09-01') is null, 'A observation untouched';
  assert (select mood from public.daily_observations where user_id = '77777777-7777-7777-7777-777777777777' and date = '2026-09-01') = 5, 'B observation written';
end $$;

-- cleanup
delete from auth.users where id in (:'A', :'B');
\echo '   PASS 04_repository_sql_semantics'
