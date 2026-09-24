-- =============================================================================
-- Lunelle V2 — G10: forecasts.model_version
--
-- API_CONTRACT.md §7.5 requires every persisted forecast snapshot to record the
-- engine version that produced it, so a change in engine behaviour is auditable
-- and old snapshots are never mistaken for current ones.
--
-- Additive only. No DEFAULT on purpose: the orchestration layer must supply the
-- value explicitly for every row (it comes from the engine, not the database).
-- `forecasts` has never had a writer, so no environment holds rows that would
-- need back-filling; if one did, this statement fails loudly instead of
-- inventing a version.
-- =============================================================================

alter table public.forecasts
  add column model_version text not null;

alter table public.forecasts
  add constraint forecasts_model_version_format
  check (model_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$');

comment on column public.forecasts.model_version is
  'Engine version identifier that produced this snapshot (e.g. cycle-1). Set by the API; required on every row.';
