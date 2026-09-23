import { z } from 'zod'
import { isoDate, uuid, dateRangeQuery, CYCLE_EVENT_TYPES } from './common.js'

const eventType = z.enum(CYCLE_EVENT_TYPES, { error: 'type must be period_start or period_end' })

/** POST /api/cycle-events body — the frozen CycleEventInput. "Not in the future" is checked in the route against the client date. */
export const cycleEventBody = z.object({ type: eventType, date: isoDate }).strict()

/** GET /api/cycle-events query: optional inclusive window and type filter. */
export const cycleEventsQuery = dateRangeQuery.safeExtend({ type: eventType.optional() })

/** DELETE /api/cycle-events/:id */
export const cycleEventParams = z.object({ id: uuid }).strict()
