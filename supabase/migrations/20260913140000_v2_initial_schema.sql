-- =============================================================================
-- Lunelle V2 — initial schema
--
-- Architecture this schema serves:
--   Expo → Supabase Auth → Express API (caller-JWT-scoped client) → Postgres + RLS
--
-- Principles:
--   * Every user-owned row carries user_id → auth.users(id) ON DELETE CASCADE.
--   * RLS is ENABLED and FORCED on every user-owned table. Policies are written
--     for the `authenticated` role only; `anon` gets no grants at all.
--   * The API never needs to bypass RLS. The only writer that bypasses RLS is the
--     future RevenueCat webhook (service_role) writing `subscription_state`.
--   * Enumerations are `text` + CHECK constraints rather than Postgres enums so
--     values can be added with a constraint swap during the sprint. The value
--     sets mirror backend/src/engines/{cycle,patternConfidence}.js.
--   * Nothing here is destructive; it is safe to run on a fresh database.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Keep updated_at honest regardless of what the client sends.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at with the transaction time.';

-- Controlled symptom vocabulary. daily_observations.symptoms is text[] checked
-- against this list (option A: simplest safe representation for V2). To add a
-- symptom, CREATE OR REPLACE this function in a later migration; existing rows
-- are unaffected. The keys are also the `key` values the pattern engine sees.
create or replace function public.is_valid_symptom_list(symptoms text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    symptoms is not null
    and cardinality(symptoms) <= 20
    -- no duplicates
    and cardinality(symptoms) = (select count(distinct s) from unnest(symptoms) as s)
    -- every value is in the controlled vocabulary
    and symptoms <@ array[
      'cramps', 'headache', 'bloating', 'fatigue', 'breast_tenderness',
      'acne', 'back_pain', 'nausea', 'cravings', 'insomnia',
      'spotting', 'mood_swings', 'anxiety', 'irritability', 'low_libido',
      'high_libido', 'diarrhea', 'constipation', 'hot_flashes', 'dizziness'
    ]::text[];
$$;

comment on function public.is_valid_symptom_list(text[]) is
  'CHECK helper: symptoms must be unique, at most 20, and drawn from the controlled vocabulary.';

-- Helper functions are not part of the API surface.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.is_valid_symptom_list(text[]) from public, anon;
grant execute on function public.is_valid_symptom_list(text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 1. profiles — one row per auth user, minimal, no health data
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  -- IANA zone; "today" for cycle-day maths is computed in the user's zone by the API.
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 60),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 64)
);

comment on table public.profiles is 'Minimal per-user profile. id = auth.users.id. No health data lives here.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. cycle_settings — one row per user, onboarding answers / fallbacks
-- -----------------------------------------------------------------------------
create table public.cycle_settings (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Fallbacks used by the cycle engine when history is thin (< 3 cycles).
  reported_cycle_length   smallint,
  reported_period_length  smallint,
  -- Onboarding snapshot only. The engine reads cycle_events; the API should also
  -- write a period_start event when this is set, so the two never disagree.
  last_period_start       date,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint cycle_settings_one_per_user unique (user_id),
  -- Mirrors MIN/MAX_PLAUSIBLE_CYCLE_LENGTH in engines/cycle.js.
  constraint cycle_settings_cycle_length_range check (reported_cycle_length is null or reported_cycle_length between 15 and 60),
  constraint cycle_settings_period_length_range check (reported_period_length is null or reported_period_length between 1 and 14),
  constraint cycle_settings_last_period_start_range check (last_period_start is null or last_period_start between date '2000-01-01' and date '2100-12-31')
);

comment on table public.cycle_settings is 'User-reported cycle parameters; the engine uses them as fallbacks when observed history is insufficient.';

create trigger cycle_settings_set_updated_at
  before update on public.cycle_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. cycle_events — the observed history the forecast engine is built on
-- -----------------------------------------------------------------------------
create table public.cycle_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null,
  date        date not null,
  created_at  timestamptz not null default now(),

  constraint cycle_events_type_valid check (type in ('period_start', 'period_end')),
  constraint cycle_events_date_range check (date between date '2000-01-01' and date '2100-12-31'),
  -- A user cannot log the same event type twice on one day.
  constraint cycle_events_unique_per_day unique (user_id, type, date)
);

comment on table public.cycle_events is 'Period start/end events. period_start rows are the input to engines/cycle.js.';

create index cycle_events_user_date_idx on public.cycle_events (user_id, date desc);

-- -----------------------------------------------------------------------------
-- 4. daily_observations — one check-in per user per day
-- -----------------------------------------------------------------------------
create table public.daily_observations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  -- 1 = very low … 5 = very high. Both optional so a symptom-only check-in is valid.
  mood        smallint,
  energy      smallint,
  symptoms    text[] not null default '{}',
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Product contract: one observation per day; the API upserts on (user_id, date).
  constraint daily_observations_one_per_day unique (user_id, date),
  constraint daily_observations_mood_scale check (mood is null or mood between 1 and 5),
  constraint daily_observations_energy_scale check (energy is null or energy between 1 and 5),
  constraint daily_observations_symptoms_valid check (public.is_valid_symptom_list(symptoms)),
  constraint daily_observations_note_length check (note is null or char_length(note) <= 500),
  constraint daily_observations_date_range check (date between date '2000-01-01' and date '2100-12-31')
);

comment on table public.daily_observations is 'Daily mood/energy/symptom check-in. Input to engines/patternConfidence.js.';

create trigger daily_observations_set_updated_at
  before update on public.daily_observations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. journal_entries — free text; cycle day/phase are derived at read time
-- -----------------------------------------------------------------------------
create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The day the entry is about (user-local), so phase can be derived from cycle_events later.
  entry_date  date not null default current_date,
  title       text,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint journal_entries_title_length check (title is null or char_length(title) between 1 and 120),
  constraint journal_entries_body_length check (char_length(body) between 1 and 5000),
  constraint journal_entries_date_range check (entry_date between date '2000-01-01' and date '2100-12-31')
);

comment on table public.journal_entries is 'Private journal. No mood/symptom columns: join daily_observations on (user_id, entry_date) if needed.';

create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc, created_at desc);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. forecasts — append-only snapshots of the next predicted period
-- -----------------------------------------------------------------------------
create table public.forecasts (
  id                             uuid primary key default gen_random_uuid(),
  user_id                        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Predicted window for the next period start (earliest … latest).
  window_start                   date not null,
  window_end                     date not null,
  expected_period_date           date not null,
  -- Half-width of the window around expected_period_date (PredictedPeriod.uncertaintyDays).
  period_uncertainty_days        smallint not null,
  -- Extra slack applied to the window edges for irregular history.
  window_offset_uncertainty_days smallint not null default 0,
  -- Maps from engines/cycle.js lengthSource: reported→user_reported, history→observed_cycle.
  -- 'calibrated' is reserved for forecasts adjusted by observed variability.
  basis                          text not null,
  generated_at                   timestamptz not null default now(),

  constraint forecasts_basis_valid check (basis in ('user_reported', 'observed_cycle', 'calibrated')),
  constraint forecasts_window_ordered check (window_start <= expected_period_date and expected_period_date <= window_end),
  constraint forecasts_uncertainty_nonnegative check (period_uncertainty_days >= 0 and window_offset_uncertainty_days >= 0),
  constraint forecasts_date_range check (window_start >= date '2000-01-01' and window_end <= date '2100-12-31')
);

comment on table public.forecasts is 'Snapshots produced by engines/cycle.js. The API reads the latest row per user.';

create index forecasts_user_generated_idx on public.forecasts (user_id, generated_at desc);

-- -----------------------------------------------------------------------------
-- 7. pattern_evidence — current assessment per (user, pattern_type, signal)
-- -----------------------------------------------------------------------------
create table public.pattern_evidence (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- ObservationKind in engines/patternConfidence.js.
  pattern_type       text not null,
  -- The observation key, e.g. 'cramps' (symptom) or 'low' (mood bucket).
  signal             text not null,
  -- Phase the signal clusters in; null only if the engine could not pick one.
  phase              text,
  confidence_tier    text not null,
  supporting_cycles  smallint not null,
  assessable_cycles  smallint not null,
  -- supporting_cycles / assessable_cycles, as computed by the engine.
  consistency        numeric(4, 3) not null,
  -- Structured CycleEvidence[] from the engine — dates and cycle days the user can verify.
  -- This is the source of truth; any prose shown to the user is rendered from it.
  evidence           jsonb not null default '[]'::jsonb,
  range_start        date,
  range_end          date,
  computed_at        timestamptz not null default now(),

  -- One current row per pattern; the API upserts on recompute.
  constraint pattern_evidence_one_per_signal unique (user_id, pattern_type, signal),
  constraint pattern_evidence_type_valid check (pattern_type in ('symptom', 'mood')),
  constraint pattern_evidence_signal_length check (char_length(signal) between 1 and 40),
  constraint pattern_evidence_phase_valid check (phase is null or phase in ('menstrual', 'follicular', 'ovulatory', 'luteal')),
  -- Only patterns that reached a tier are stored; 'none' is not persisted.
  constraint pattern_evidence_tier_valid check (confidence_tier in ('emerging', 'likely', 'established')),
  constraint pattern_evidence_counts_valid check (
    assessable_cycles >= 0
    and supporting_cycles >= 0
    and supporting_cycles <= assessable_cycles
  ),
  constraint pattern_evidence_consistency_range check (consistency between 0 and 1),
  constraint pattern_evidence_evidence_is_array check (jsonb_typeof(evidence) = 'array'),
  constraint pattern_evidence_range_ordered check (
    (range_start is null and range_end is null)
    or (range_start is not null and range_end is not null and range_start <= range_end)
  )
);

comment on table public.pattern_evidence is 'Deterministic output of engines/patternConfidence.js. Correlational only; never stores AI prose.';

create index pattern_evidence_user_tier_idx on public.pattern_evidence (user_id, confidence_tier, computed_at desc);

-- -----------------------------------------------------------------------------
-- 8. subscription_state — read-only to users; written by the RevenueCat webhook
-- -----------------------------------------------------------------------------
create table public.subscription_state (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  is_plus      boolean not null default false,
  entitlement  text,
  source       text not null default 'revenuecat',
  updated_at   timestamptz not null default now(),

  constraint subscription_state_source_valid check (source = 'revenuecat'),
  constraint subscription_state_entitlement_length check (entitlement is null or char_length(entitlement) between 1 and 64)
);

comment on table public.subscription_state is 'Entitlement mirror. Users may only SELECT their own row; service_role (RevenueCat webhook) owns writes.';

create trigger subscription_state_set_updated_at
  before update on public.subscription_state
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auth → profile bootstrap
-- Standard Supabase pattern: runs as the function owner after a new auth user is
-- inserted, so the row exists before the first authenticated request. Also seeds
-- the read-only subscription_state row (default: not Plus) because users cannot
-- insert it themselves. ON CONFLICT keeps it idempotent.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.subscription_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- SECURITY DEFINER: must never be callable through the API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.cycle_settings      enable row level security;
alter table public.cycle_events        enable row level security;
alter table public.daily_observations  enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.forecasts           enable row level security;
alter table public.pattern_evidence    enable row level security;
alter table public.subscription_state  enable row level security;

-- FORCE: even the table owner is subject to RLS. service_role keeps BYPASSRLS,
-- so the webhook path is unaffected.
alter table public.profiles            force row level security;
alter table public.cycle_settings      force row level security;
alter table public.cycle_events        force row level security;
alter table public.daily_observations  force row level security;
alter table public.journal_entries     force row level security;
alter table public.forecasts           force row level security;
alter table public.pattern_evidence    force row level security;
alter table public.subscription_state  force row level security;

-- profiles: id is the identity.
create policy "profiles: select own"  on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: insert own"  on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own"  on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: delete own"  on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- cycle_settings
create policy "cycle_settings: select own" on public.cycle_settings for select to authenticated using (user_id = (select auth.uid()));
create policy "cycle_settings: insert own" on public.cycle_settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cycle_settings: update own" on public.cycle_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cycle_settings: delete own" on public.cycle_settings for delete to authenticated using (user_id = (select auth.uid()));

-- cycle_events
create policy "cycle_events: select own" on public.cycle_events for select to authenticated using (user_id = (select auth.uid()));
create policy "cycle_events: insert own" on public.cycle_events for insert to authenticated with check (user_id = (select auth.uid()));
create policy "cycle_events: update own" on public.cycle_events for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "cycle_events: delete own" on public.cycle_events for delete to authenticated using (user_id = (select auth.uid()));

-- daily_observations
create policy "daily_observations: select own" on public.daily_observations for select to authenticated using (user_id = (select auth.uid()));
create policy "daily_observations: insert own" on public.daily_observations for insert to authenticated with check (user_id = (select auth.uid()));
create policy "daily_observations: update own" on public.daily_observations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "daily_observations: delete own" on public.daily_observations for delete to authenticated using (user_id = (select auth.uid()));

-- journal_entries
create policy "journal_entries: select own" on public.journal_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "journal_entries: insert own" on public.journal_entries for insert to authenticated with check (user_id = (select auth.uid()));
create policy "journal_entries: update own" on public.journal_entries for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "journal_entries: delete own" on public.journal_entries for delete to authenticated using (user_id = (select auth.uid()));

-- forecasts (written by the API on the user's behalf through the user-scoped client)
create policy "forecasts: select own" on public.forecasts for select to authenticated using (user_id = (select auth.uid()));
create policy "forecasts: insert own" on public.forecasts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "forecasts: update own" on public.forecasts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "forecasts: delete own" on public.forecasts for delete to authenticated using (user_id = (select auth.uid()));

-- pattern_evidence (same: API writes through the user-scoped client)
create policy "pattern_evidence: select own" on public.pattern_evidence for select to authenticated using (user_id = (select auth.uid()));
create policy "pattern_evidence: insert own" on public.pattern_evidence for insert to authenticated with check (user_id = (select auth.uid()));
create policy "pattern_evidence: update own" on public.pattern_evidence for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "pattern_evidence: delete own" on public.pattern_evidence for delete to authenticated using (user_id = (select auth.uid()));

-- subscription_state: SELECT only. No insert/update/delete policy exists for
-- authenticated, so those statements are denied even before grants are checked.
create policy "subscription_state: select own" on public.subscription_state for select to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants — explicit, so behaviour does not depend on api.auto_expose_new_tables
-- or Supabase's default privileges. anon gets nothing on any table here.
-- -----------------------------------------------------------------------------
revoke all on table
  public.profiles, public.cycle_settings, public.cycle_events, public.daily_observations,
  public.journal_entries, public.forecasts, public.pattern_evidence, public.subscription_state
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.profiles, public.cycle_settings, public.cycle_events, public.daily_observations,
  public.journal_entries, public.forecasts, public.pattern_evidence
to authenticated;

grant select on table public.subscription_state to authenticated;

grant all on table
  public.profiles, public.cycle_settings, public.cycle_events, public.daily_observations,
  public.journal_entries, public.forecasts, public.pattern_evidence, public.subscription_state
to service_role;
