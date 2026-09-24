/**
 * Lunelle V2 — shared types.
 *
 * The one vocabulary both halves of the team build against. Each section is
 * labelled with the layer it describes:
 *
 *   [DB]      mirrors a table in supabase/migrations/20260913140000_v2_initial_schema.sql,
 *             camelCased for the wire. `user_id` is never present: identity is
 *             the authenticated session, and the API sets it from the token.
 *   [ENGINE]  verbatim from the JSDoc contracts in backend/src/engines/*.js.
 *             Pure, deterministic, no clock — "today" is always a caller-supplied date.
 *   [API]     the HTTP envelope and error codes.
 *   [UI]      composite snapshots assembled by the API for one screen each.
 *
 * All value unions are derived from shared/constants.ts so the two files
 * cannot drift.
 */

import type {
  API_ERROR_CODES,
  CONFIDENCES,
  CONFIDENCE_TIERS,
  CYCLE_EVENT_TYPES,
  EVIDENCE_PHASES,
  FORECAST_BASES,
  LENGTH_SOURCES,
  OBSERVATION_KINDS,
  PHASES,
  REGULARITIES,
  SUBSCRIPTION_SOURCES,
  SYMPTOMS,
} from './constants'

// ===========================================================================
// Scalars
// ===========================================================================

/** Calendar date "YYYY-MM-DD". No time zone. Used for anything that is about a day. */
export type ISODate = string

/** RFC 3339 UTC timestamp, e.g. "2026-09-13T14:00:00.000Z". Used for anything that is about a moment. */
export type ISOTimestamp = string

export type UUID = string

// ===========================================================================
// Closed value sets — derived from shared/constants.ts
// ===========================================================================

export type Symptom = (typeof SYMPTOMS)[number]
export type Phase = (typeof PHASES)[number]
export type EvidencePhase = (typeof EVIDENCE_PHASES)[number]
export type ConfidenceTier = (typeof CONFIDENCE_TIERS)[number]
export type CycleEventType = (typeof CYCLE_EVENT_TYPES)[number]
export type Regularity = (typeof REGULARITIES)[number]
export type LengthSource = (typeof LENGTH_SOURCES)[number]
export type Confidence = (typeof CONFIDENCES)[number]
export type ForecastBasis = (typeof FORECAST_BASES)[number]
export type ObservationKind = (typeof OBSERVATION_KINDS)[number]
export type SubscriptionSource = (typeof SUBSCRIPTION_SOURCES)[number]
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

// ===========================================================================
// [DB] Entities — rows the user owns, as they cross the API boundary
// ===========================================================================

/** [DB] public.profiles — minimal; no health data lives here. `id` = auth user id. */
export interface Profile {
  id: UUID
  displayName: string | null
  /** IANA zone name. The API uses it only as a fallback; screens send device-local dates. */
  timezone: string
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

/** [DB] public.cycle_settings — one row per user, written during onboarding. */
export interface CycleSettings {
  id: UUID
  /** CYCLE_LENGTH_RANGE (15–60) or null */
  reportedCycleLength: number | null
  /** PERIOD_LENGTH_RANGE (1–14) or null */
  reportedPeriodLength: number | null
  /** Onboarding snapshot. Saving it also creates a `period_start` cycle event. */
  lastPeriodStart: ISODate | null
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

/** [DB] Upsert payload for PUT /api/cycle-settings. Omitted keys are left unchanged; `null` clears. */
export interface CycleSettingsInput {
  reportedCycleLength?: number | null
  reportedPeriodLength?: number | null
  lastPeriodStart?: ISODate | null
}

/** [DB] public.cycle_events — a period start or end on a given day. */
export interface CycleEvent {
  id: UUID
  type: CycleEventType
  date: ISODate
  createdAt: ISOTimestamp
}

/** [DB] Payload for POST /api/cycle-events. Same (type, date) twice → `conflict`. */
export interface CycleEventInput {
  type: CycleEventType
  date: ISODate
}

/** [DB] public.daily_observations — one check-in per user per day. */
export interface DailyObservation {
  id: UUID
  date: ISODate
  /** MOOD_SCALE 1–5, or null when not answered */
  mood: number | null
  /** ENERGY_SCALE 1–5, or null when not answered */
  energy: number | null
  /** Unique values from SYMPTOMS, at most MAX_SYMPTOMS_PER_DAY */
  symptoms: Symptom[]
  /** ≤ TEXT_LIMITS.observationNote characters */
  note: string | null
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

/**
 * [DB] Payload for PUT /api/observations/:date. The date lives in the URL.
 * Omitted keys are left unchanged on an existing row; `null` clears.
 */
export interface DailyObservationInput {
  mood?: number | null
  energy?: number | null
  symptoms?: Symptom[]
  note?: string | null
}

/** [DB] public.journal_entries — free text, private. Cycle day/phase are derived at read time, not stored. */
export interface JournalEntry {
  id: UUID
  /** The day the entry is about (device-local). */
  entryDate: ISODate
  /** ≤ TEXT_LIMITS.journalTitle, or null */
  title: string | null
  /** 1 … TEXT_LIMITS.journalBody characters */
  body: string
  createdAt: ISOTimestamp
  updatedAt: ISOTimestamp
}

/** [DB] Create/update payload for a journal entry. `entryDate` defaults to the device-local date on create. */
export interface JournalEntryInput {
  entryDate?: ISODate
  title?: string | null
  body: string
}

/**
 * [DB] public.subscription_state — read-only to the user. Written only by the
 * RevenueCat webhook (service role). A default row (isPlus=false) exists from signup.
 */
export interface SubscriptionState {
  isPlus: boolean
  /** RevenueCat entitlement identifier, or null when none is active */
  entitlement: string | null
  source: SubscriptionSource
  updatedAt: ISOTimestamp
}

// ===========================================================================
// [ENGINE] Cycle engine — backend/src/engines/cycle.js
// ===========================================================================

/** [ENGINE] CycleStats — the statistics every forecast and position is built on. */
export interface CycleStats {
  /** Completed cycle lengths in days, oldest → newest (implausible lengths excluded, last 12 kept). */
  cycleLengths: number[]
  /** cycleLengths.length */
  sampleSize: number
  /** Length used for forecasting: median of history, else reported, else DEFAULT_CYCLE_LENGTH. */
  typicalLength: number
  lengthSource: LengthSource
  /** null when sampleSize is 0 */
  meanLength: number | null
  /** Population std dev; null when sampleSize < 2 */
  stdDev: number | null
  /** 'insufficient' below 3 completed cycles, else bucketed by stdDev */
  regularity: Regularity
  lastPeriodStart: ISODate | null
}

/**
 * [ENGINE] PredictedPeriod — a forecast is always a window plus a confidence,
 * never a bare date. earliestStart ≤ expectedStart ≤ latestStart.
 */
export interface PredictedPeriod {
  /** 1 = next period, 2 = the one after, … */
  ordinal: number
  expectedStart: ISODate
  earliestStart: ISODate
  latestStart: ISODate
  /** Half-width of the window; non-decreasing with ordinal and irregularity. */
  uncertaintyDays: number
  confidence: Confidence
}

/** [ENGINE] Forecast — full output of forecastCycles(); TodaySnapshot flattens the first period. */
export interface Forecast {
  asOfDate: ISODate
  /** Ordered by ordinal; only periods whose window touches the horizon. */
  predictedPeriods: PredictedPeriod[]
  basis: CycleStats
  /** Plain-language notes, e.g. "Based on your reported cycle length only". Always show them. */
  caveats: string[]
}

/** [ENGINE] CyclePosition — where a given date sits in the current cycle. */
export interface CyclePosition {
  /** 1 on the most recent period start; null when there is no history. */
  cycleDay: number | null
  /** 'unknown' when there is no history. */
  phase: Phase
  /** Cycle length the phase boundaries were derived from. */
  typicalLength: number
  /** The date is past the latest predicted start of the next period. */
  isOverdue: boolean
  /** Phase boundaries came from a fallback length, not observed history. */
  isEstimated: boolean
  confidence: Confidence
}

// ===========================================================================
// [ENGINE] Pattern Confidence engine — backend/src/engines/patternConfidence.js
//
// Correlational only. Tiers are earned by counting recurrences across cycles;
// `evidence` lists the exact dates and cycle days behind each count so the user
// can verify every claim. No field may express a cause.
// ===========================================================================

/** [ENGINE] CycleEvidence — one row per cycle the assessment looked at, including non-supporting ones. */
export interface CycleEvidence {
  cycleIndex: number
  cycleStart: ISODate
  /** Dates the target was logged in this cycle, ascending. Traceable to daily_observations. */
  observedOn: ISODate[]
  /** 1-based cycle day of each observedOn entry. */
  cycleDays: number[]
  /** Phase shared by the observations, or null if they span phases. */
  phase: EvidencePhase | null
  /** Counts toward supportingCycles. */
  supports: boolean
  /** Too few logged days to assess; excluded from assessableCycles, never counted against the pattern. */
  sparse: boolean
}

/** [ENGINE] PatternAssessment — output of assessPattern(); persisted to pattern_evidence when tier ≠ 'none'. */
export interface PatternAssessment {
  target: { kind: ObservationKind; key: string }
  tier: ConfidenceTier
  totalCycles: number
  assessableCycles: number
  supportingCycles: number
  sparseCycles: number
  /** supportingCycles / assessableCycles, 0–1 */
  consistency: number
  dominantPhase: EvidencePhase | null
  evidence: CycleEvidence[]
  /** Non-causal sentence built only from the engine's fixed templates. Not AI prose. */
  summary: string
  caveats: string[]
}

// ===========================================================================
// [API] Envelope, errors, session
// ===========================================================================

/** [API] Every 2xx body. */
export interface ApiSuccess<T> {
  success: true
  data: T
}

/** [API] Every non-2xx body. `code` is the branching key; `message` is for logs and fallback copy. */
export interface ApiFailure {
  success: false
  code: ApiErrorCode
  message: string
  /** Field-level detail for `validation_error`; shape is route-specific and optional. */
  details?: unknown
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

/** [API] What screens are allowed to know about the signed-in user. The access token never leaves the API layer. */
export interface AuthSession {
  userId: UUID
  email: string | null
}

// ===========================================================================
// [UI] Screen snapshots — composites assembled by the API, one round-trip each
// ===========================================================================

/**
 * [UI] GET /api/today?date=YYYY-MM-DD
 *
 * `nextPeriod` is null — never a fabricated default — until the user has
 * either cycle settings or a period_start event. Always render `caveats`.
 */
export interface TodaySnapshot {
  /** Echo of the device-local date the snapshot was computed for. */
  date: ISODate
  /** false → route the user to onboarding. */
  hasCycleSettings: boolean
  position: CyclePosition
  /** Window for the next period start, or null when there is nothing to base it on. */
  nextPeriod: PredictedPeriod | null
  /** Where the prediction came from; null when nextPeriod is null. */
  forecastBasis: ForecastBasis | null
  caveats: string[]
  loggedDays: {
    /** Distinct days with a daily observation, all time. */
    total: number
    /** Distinct days with a daily observation in the 30 days ending on `date`. */
    last30: number
  }
  /** The observation for `date`, if one exists. */
  todayObservation: DailyObservation | null
}

/** [UI] One cycle in the history list, derived from cycle_events. */
export interface CycleSummary {
  startDate: ISODate
  /** Day before the next period_start; null for the current cycle. */
  endDate: ISODate | null
  /** Days from startDate to the next period_start; null for the current cycle. */
  cycleLength: number | null
  /** Days from period_start to period_end; null when no period_end was logged. */
  periodLength: number | null
  isCurrent: boolean
}

/** [UI] GET /api/you */
export interface YouSnapshot {
  stats: CycleStats
  /** Newest first. */
  cycles: CycleSummary[]
  /** Only assessments with tier ≠ 'none', ordered established → emerging. */
  patterns: PatternAssessment[]
}
