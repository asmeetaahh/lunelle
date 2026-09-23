import { z } from 'zod'
import { isoDate, CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE, atLeastOneField } from './common.js'

const KEYS = ['reportedCycleLength', 'reportedPeriodLength', 'lastPeriodStart']
const guard = atLeastOneField(KEYS)

/**
 * PUT /api/cycle-settings body — the frozen CycleSettingsInput.
 * Omitted = unchanged, null = clear. Unknown keys (including user_id) are rejected.
 */
export const cycleSettingsBody = z
  .object({
    reportedCycleLength: z.number().int().min(CYCLE_LENGTH_RANGE.min).max(CYCLE_LENGTH_RANGE.max).nullable().optional(),
    reportedPeriodLength: z.number().int().min(PERIOD_LENGTH_RANGE.min).max(PERIOD_LENGTH_RANGE.max).nullable().optional(),
    lastPeriodStart: isoDate.nullable().optional(),
  })
  .strict()
  .refine(guard.check, { error: guard.error })
