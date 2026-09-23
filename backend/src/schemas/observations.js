import { z } from 'zod'
import { isoDate, dateRangeQuery, MOOD_SCALE, ENERGY_SCALE, SYMPTOMS, MAX_SYMPTOMS_PER_DAY, OBSERVATION_NOTE_MAX, atLeastOneField } from './common.js'

const KEYS = ['mood', 'energy', 'symptoms', 'note']
const guard = atLeastOneField(KEYS)

const scale = ({ min, max }, name) => z.number().int().min(min).max(max).nullable().optional()

/**
 * PUT /api/observations/:date body — the frozen DailyObservationInput.
 * Omitted = unchanged, null = clear. A body with no fields is rejected: it
 * would create or touch a row without saying anything.
 */
export const observationBody = z
  .object({
    mood: scale(MOOD_SCALE, 'mood'),
    energy: scale(ENERGY_SCALE, 'energy'),
    symptoms: z
      .array(z.enum(SYMPTOMS, { error: 'unknown symptom' }))
      .max(MAX_SYMPTOMS_PER_DAY)
      .refine((list) => new Set(list).size === list.length, { error: 'symptoms must be unique' })
      .optional(),
    note: z.string().max(OBSERVATION_NOTE_MAX).nullable().optional(),
  })
  .strict()
  .refine(guard.check, { error: guard.error })

/** PUT /api/observations/:date params. "Not in the future" is checked in the route. */
export const observationParams = z.object({ date: isoDate }).strict()

/** GET /api/observations query. Defaults (last DEFAULT_OBSERVATION_RANGE_DAYS) are applied in the route from the client date. */
export const observationsQuery = dateRangeQuery
