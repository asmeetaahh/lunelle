/**
 * Shared zod building blocks and the request-validation bounds.
 *
 * Bounds that already exist in the engines are imported from there. The rest
 * mirror shared/constants.ts and are pinned by test/schemas.test.js — the
 * backend cannot import .ts at runtime in its current Node 20 image.
 */
import { z } from 'zod'
import { isISODate, MIN_PLAUSIBLE_CYCLE_LENGTH, MAX_PLAUSIBLE_CYCLE_LENGTH } from '../engines/cycle.js'
import { SYMPTOM_KEYS } from '../engines/patternConfidence.js'

// ---- pinned to shared/constants.ts ------------------------------------------
export const MOOD_SCALE = Object.freeze({ min: 1, max: 5 })
export const ENERGY_SCALE = Object.freeze({ min: 1, max: 5 })
export const CYCLE_LENGTH_RANGE = Object.freeze({ min: MIN_PLAUSIBLE_CYCLE_LENGTH, max: MAX_PLAUSIBLE_CYCLE_LENGTH })
export const PERIOD_LENGTH_RANGE = Object.freeze({ min: 1, max: 14 })
export const OBSERVATION_NOTE_MAX = 500
export const MAX_SYMPTOMS_PER_DAY = 20
export const DATE_BOUNDS = Object.freeze({ min: '2000-01-01', max: '2100-12-31' })
export const DEFAULT_OBSERVATION_RANGE_DAYS = 90
export const CYCLE_EVENT_TYPES = Object.freeze(['period_start', 'period_end'])
export const SYMPTOMS = SYMPTOM_KEYS

// ---- primitives ------------------------------------------------------------------

/** "YYYY-MM-DD", a real calendar day, inside DATE_BOUNDS. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'must be YYYY-MM-DD' })
  .refine(isISODate, { error: 'must be a real calendar date' })
  .refine((d) => d >= DATE_BOUNDS.min && d <= DATE_BOUNDS.max, { error: `must be between ${DATE_BOUNDS.min} and ${DATE_BOUNDS.max}` })

export const uuid = z.uuid({ error: 'must be a UUID' })

/** Optional inclusive date window. Both ends optional; when both are present, from ≤ to. */
export const dateRangeQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .strict()
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, { error: 'from must not be after to', path: ['from'] })

/** Object-level guard: a merge payload must carry at least one key (undefined does not count). */
export const atLeastOneField = (keys) => ({
  check: (obj) => keys.some((k) => obj[k] !== undefined),
  error: `at least one of ${keys.join(', ')} is required`,
})
