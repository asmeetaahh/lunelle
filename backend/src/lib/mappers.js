/**
 * DB ↔ API translation — the single place snake_case rows become camelCase
 * contract objects and back.
 *
 * Rules:
 *   - Explicit field lists only. Nothing is copied by iteration, so `user_id`
 *     can never reach a contract object, and a new DB column never leaks until
 *     someone adds it here on purpose.
 *   - `toX(row)` never invents values: nulls stay null, timestamps and date
 *     strings pass through unchanged, arrays are copied as-is.
 *   - `toXRow(input)` copies only keys that are present and not undefined, so
 *     "omitted = unchanged, null = clear" survives into the PostgREST upsert.
 *   - No business logic. No defaults. No identity.
 *
 * `*_COLUMNS` are the exact select lists repositories use; none includes user_id.
 */

const requireRow = (row, name) => {
  if (!row || typeof row !== 'object') throw new TypeError(`${name}: expected a database row`)
  return row
}

/** Copy `source[from]` to `target[to]` only when present and not undefined (null is copied). */
const copyIf = (source, from, target, to) => {
  if (source[from] !== undefined) target[to] = source[from]
}

/** numeric columns may arrive as strings from PostgREST; DB precision is preserved by the column type. */
const toNumber = (value) => (value === null || value === undefined ? value : Number(value))

// ---------------------------------------------------------------------------
// profiles → Profile
// ---------------------------------------------------------------------------

export const PROFILE_COLUMNS = 'id, display_name, timezone, created_at, updated_at'

/** @returns {{ id: string, displayName: string|null, timezone: string, createdAt: string, updatedAt: string }} */
export function toProfile(row) {
  requireRow(row, 'toProfile')
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** @param {{ displayName?: string|null, timezone?: string }} input */
export function toProfileRow(input) {
  const row = {}
  copyIf(input, 'displayName', row, 'display_name')
  copyIf(input, 'timezone', row, 'timezone')
  return row
}

// ---------------------------------------------------------------------------
// cycle_settings → CycleSettings
// ---------------------------------------------------------------------------

export const CYCLE_SETTINGS_COLUMNS = 'id, reported_cycle_length, reported_period_length, last_period_start, created_at, updated_at'

/** @returns {import('../../../shared/types').CycleSettings} */
export function toCycleSettings(row) {
  requireRow(row, 'toCycleSettings')
  return {
    id: row.id,
    reportedCycleLength: row.reported_cycle_length,
    reportedPeriodLength: row.reported_period_length,
    lastPeriodStart: row.last_period_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** @param {import('../../../shared/types').CycleSettingsInput} input */
export function toCycleSettingsRow(input) {
  const row = {}
  copyIf(input, 'reportedCycleLength', row, 'reported_cycle_length')
  copyIf(input, 'reportedPeriodLength', row, 'reported_period_length')
  copyIf(input, 'lastPeriodStart', row, 'last_period_start')
  return row
}

// ---------------------------------------------------------------------------
// cycle_events → CycleEvent
// ---------------------------------------------------------------------------

export const CYCLE_EVENT_COLUMNS = 'id, type, date, created_at'

/** @returns {import('../../../shared/types').CycleEvent} */
export function toCycleEvent(row) {
  requireRow(row, 'toCycleEvent')
  return { id: row.id, type: row.type, date: row.date, createdAt: row.created_at }
}

/** @param {import('../../../shared/types').CycleEventInput} input */
export function toCycleEventRow(input) {
  const row = {}
  copyIf(input, 'type', row, 'type')
  copyIf(input, 'date', row, 'date')
  return row
}

// ---------------------------------------------------------------------------
// daily_observations → DailyObservation
// ---------------------------------------------------------------------------

export const OBSERVATION_COLUMNS = 'id, date, mood, energy, symptoms, note, created_at, updated_at'

/** @returns {import('../../../shared/types').DailyObservation} */
export function toObservation(row) {
  requireRow(row, 'toObservation')
  return {
    id: row.id,
    date: row.date,
    mood: row.mood,
    energy: row.energy,
    symptoms: Array.isArray(row.symptoms) ? [...row.symptoms] : row.symptoms,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** @param {import('../../../shared/types').DailyObservationInput} input */
export function toObservationRow(input) {
  const row = {}
  copyIf(input, 'mood', row, 'mood')
  copyIf(input, 'energy', row, 'energy')
  if (input.symptoms !== undefined) row.symptoms = Array.isArray(input.symptoms) ? [...input.symptoms] : input.symptoms
  copyIf(input, 'note', row, 'note')
  return row
}

// ---------------------------------------------------------------------------
// journal_entries → JournalEntry
// ---------------------------------------------------------------------------

export const JOURNAL_COLUMNS = 'id, entry_date, title, body, created_at, updated_at'

/** @returns {import('../../../shared/types').JournalEntry} */
export function toJournalEntry(row) {
  requireRow(row, 'toJournalEntry')
  return {
    id: row.id,
    entryDate: row.entry_date,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** @param {import('../../../shared/types').JournalEntryInput | Partial<import('../../../shared/types').JournalEntryInput>} input */
export function toJournalEntryRow(input) {
  const row = {}
  copyIf(input, 'entryDate', row, 'entry_date')
  copyIf(input, 'title', row, 'title')
  copyIf(input, 'body', row, 'body')
  return row
}

// ---------------------------------------------------------------------------
// forecasts → ForecastSnapshot (internal; the wire flattens it into TodaySnapshot)
// ---------------------------------------------------------------------------

export const FORECAST_COLUMNS =
  'id, window_start, window_end, expected_period_date, period_uncertainty_days, window_offset_uncertainty_days, basis, generated_at, model_version'

/**
 * @typedef {Object} ForecastSnapshot
 * @property {string} id
 * @property {string} windowStart
 * @property {string} windowEnd
 * @property {string} expectedPeriodDate
 * @property {number} periodUncertaintyDays
 * @property {number} windowOffsetUncertaintyDays
 * @property {'user_reported'|'observed_cycle'|'calibrated'} basis
 * @property {string} generatedAt
 * @property {string} modelVersion
 */

/** @returns {ForecastSnapshot} */
export function toForecastSnapshot(row) {
  requireRow(row, 'toForecastSnapshot')
  return {
    id: row.id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    expectedPeriodDate: row.expected_period_date,
    periodUncertaintyDays: row.period_uncertainty_days,
    windowOffsetUncertaintyDays: row.window_offset_uncertainty_days,
    basis: row.basis,
    generatedAt: row.generated_at,
    modelVersion: row.model_version,
  }
}

const FORECAST_INPUT_KEYS = [
  ['windowStart', 'window_start'],
  ['windowEnd', 'window_end'],
  ['expectedPeriodDate', 'expected_period_date'],
  ['periodUncertaintyDays', 'period_uncertainty_days'],
  ['windowOffsetUncertaintyDays', 'window_offset_uncertainty_days'],
  ['basis', 'basis'],
  ['modelVersion', 'model_version'],
]

/**
 * Full insert payload for one snapshot. Every field is required — a snapshot
 * is never partial. `generated_at` is left to the database default.
 * @param {Omit<ForecastSnapshot, 'id' | 'generatedAt'>} input
 */
export function toForecastRow(input) {
  const row = {}
  for (const [from, to] of FORECAST_INPUT_KEYS) {
    if (input[from] === undefined) throw new TypeError(`toForecastRow: ${from} is required`)
    row[to] = input[from]
  }
  return row
}

// ---------------------------------------------------------------------------
// pattern_evidence → PatternEvidenceRecord (internal; the engine rebuilds
// summary/caveats deterministically, so they are not stored)
// ---------------------------------------------------------------------------

export const PATTERN_EVIDENCE_COLUMNS =
  'id, pattern_type, signal, phase, confidence_tier, supporting_cycles, assessable_cycles, consistency, evidence, range_start, range_end, computed_at'

/**
 * @typedef {Object} PatternEvidenceRecord
 * @property {string} id
 * @property {'symptom'|'mood'} patternType
 * @property {string} signal
 * @property {'menstrual'|'follicular'|'ovulatory'|'luteal'|null} phase
 * @property {'emerging'|'likely'|'established'} confidenceTier
 * @property {number} supportingCycles
 * @property {number} assessableCycles
 * @property {number} consistency
 * @property {import('../../../shared/types').CycleEvidence[]} evidence
 * @property {string|null} rangeStart
 * @property {string|null} rangeEnd
 * @property {string} computedAt
 */

/** @returns {PatternEvidenceRecord} */
export function toPatternEvidenceRecord(row) {
  requireRow(row, 'toPatternEvidenceRecord')
  return {
    id: row.id,
    patternType: row.pattern_type,
    signal: row.signal,
    phase: row.phase,
    confidenceTier: row.confidence_tier,
    supportingCycles: row.supporting_cycles,
    assessableCycles: row.assessable_cycles,
    consistency: toNumber(row.consistency),
    evidence: Array.isArray(row.evidence) ? [...row.evidence] : row.evidence,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    computedAt: row.computed_at,
  }
}

/**
 * Full upsert payload from an engine PatternAssessment. `computedAt` must be
 * supplied so an upsert refreshes it (the DB default only applies on insert).
 * Tier 'none' is never persisted (DB CHECK agrees) and is rejected here.
 *
 * @param {import('../../../shared/types').PatternAssessment} assessment
 * @param {{ rangeStart: string|null, rangeEnd: string|null, computedAt: string }} meta
 */
export function toPatternEvidenceRow(assessment, meta) {
  requireRow(assessment, 'toPatternEvidenceRow')
  if (!assessment.target || typeof assessment.target.kind !== 'string' || typeof assessment.target.key !== 'string') {
    throw new TypeError('toPatternEvidenceRow: assessment.target is required')
  }
  if (assessment.tier === 'none') throw new TypeError('toPatternEvidenceRow: tier "none" is never persisted')
  if (!meta || meta.rangeStart === undefined || meta.rangeEnd === undefined || typeof meta.computedAt !== 'string') {
    throw new TypeError('toPatternEvidenceRow: meta needs rangeStart, rangeEnd (null allowed) and computedAt')
  }
  return {
    pattern_type: assessment.target.kind,
    signal: assessment.target.key,
    phase: assessment.dominantPhase,
    confidence_tier: assessment.tier,
    supporting_cycles: assessment.supportingCycles,
    assessable_cycles: assessment.assessableCycles,
    consistency: assessment.consistency,
    evidence: Array.isArray(assessment.evidence) ? [...assessment.evidence] : assessment.evidence,
    range_start: meta.rangeStart,
    range_end: meta.rangeEnd,
    computed_at: meta.computedAt,
  }
}

// ---------------------------------------------------------------------------
// subscription_state → SubscriptionState
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_COLUMNS = 'is_plus, entitlement, source, updated_at'

/** @returns {import('../../../shared/types').SubscriptionState} */
export function toSubscriptionState(row) {
  requireRow(row, 'toSubscriptionState')
  return {
    isPlus: row.is_plus,
    entitlement: row.entitlement,
    source: row.source,
    updatedAt: row.updated_at,
  }
}
