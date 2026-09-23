import { z } from 'zod'
import { isoDate } from './common.js'

/** GET /api/today?date= — the device-local calendar date. "Not in the future" is checked in the route. */
export const todayQuery = z.object({ date: isoDate }).strict()
