/**
 * Lunelle V2 — shared constants.
 *
 * Single source of truth for every closed value set and numeric bound that the
 * database, the engines, the Express API and the Expo app must agree on.
 * `shared/types.ts` derives its union types from these arrays, so adding a value
 * here is the only edit needed on the TypeScript side.
 *
 * Every list and bound below mirrors a CHECK constraint in
 * supabase/migrations/20260913140000_v2_initial_schema.sql or a constant in
 * backend/src/engines/*.js. Change them together.
 */

// ---------------------------------------------------------------------------
// Closed value sets (DB CHECK constraints + engine unions)
// ---------------------------------------------------------------------------

/** daily_observations.symptoms — must match public.is_valid_symptom_list(). */
export const SYMPTOMS = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'breast_tenderness',
  'acne',
  'back_pain',
  'nausea',
  'cravings',
  'insomnia',
  'spotting',
  'mood_swings',
  'anxiety',
  'irritability',
  'low_libido',
  'high_libido',
  'diarrhea',
  'constipation',
  'hot_flashes',
  'dizziness',
] as const

/** engines/cycle.js Phase. 'unknown' is returned when there is no usable history. */
export const PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'unknown'] as const

/** Phases the pattern engine can attribute evidence to (pattern_evidence.phase). */
export const EVIDENCE_PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'] as const

/** engines/patternConfidence.js ConfidenceTier, lowest → highest. 'none' is never persisted. */
export const CONFIDENCE_TIERS = ['none', 'emerging', 'likely', 'established'] as const

/** cycle_events.type */
export const CYCLE_EVENT_TYPES = ['period_start', 'period_end'] as const

/** engines/cycle.js Regularity */
export const REGULARITIES = ['insufficient', 'regular', 'somewhat_irregular', 'irregular'] as const

/** engines/cycle.js LengthSource — where the typical cycle length came from. */
export const LENGTH_SOURCES = ['history', 'reported', 'default'] as const

/** engines/cycle.js Confidence — attached to every forecast window and cycle position. */
export const CONFIDENCES = ['low', 'medium', 'high'] as const

/** forecasts.basis */
export const FORECAST_BASES = ['user_reported', 'observed_cycle', 'calibrated'] as const

/** engines/patternConfidence.js ObservationKind / pattern_evidence.pattern_type */
export const OBSERVATION_KINDS = ['symptom', 'mood'] as const

/** subscription_state.source */
export const SUBSCRIPTION_SOURCES = ['revenuecat'] as const

/**
 * Error codes an API response can carry. The first four are emitted by
 * backend/src/middleware/requireAuth.js today; the rest are reserved for routes.
 * UI branches on these, never on message text.
 */
export const API_ERROR_CODES = [
  'missing_authorization',
  'malformed_authorization',
  'invalid_token',
  'auth_unavailable',
  'validation_error',
  'not_found',
  'conflict',
  'premium_required',
  'rate_limited',
  'internal',
] as const

// ---------------------------------------------------------------------------
// Numeric bounds (DB CHECK constraints + engine constants)
// ---------------------------------------------------------------------------

/** daily_observations.mood / .energy */
export const MOOD_SCALE = { min: 1, max: 5 } as const
export const ENERGY_SCALE = { min: 1, max: 5 } as const

/** cycle_settings.reported_cycle_length — mirrors MIN/MAX_PLAUSIBLE_CYCLE_LENGTH in engines/cycle.js */
export const CYCLE_LENGTH_RANGE = { min: 15, max: 60 } as const

/** cycle_settings.reported_period_length */
export const PERIOD_LENGTH_RANGE = { min: 1, max: 14 } as const

/** Engine fallbacks when neither history nor a reported value exists. */
export const DEFAULT_CYCLE_LENGTH = 28
export const DEFAULT_PERIOD_LENGTH = 5

/** Text length limits (char_length CHECKs). */
export const TEXT_LIMITS = {
  displayName: 60,
  timezone: 64,
  observationNote: 500,
  journalTitle: 120,
  journalBody: 5000,
  patternSignal: 40,
} as const

/** daily_observations.symptoms cardinality limit */
export const MAX_SYMPTOMS_PER_DAY = 20

/** Every date column is constrained to this inclusive range ("YYYY-MM-DD"). */
export const DATE_BOUNDS = { min: '2000-01-01', max: '2100-12-31' } as const

/** Default look-back for GET /api/observations when no range is given. */
export const DEFAULT_OBSERVATION_RANGE_DAYS = 90
