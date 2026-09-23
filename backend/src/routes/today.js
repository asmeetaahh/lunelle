import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { ok } from '../lib/respond.js'
import { clientDate, assertNotFuture } from '../lib/clientDate.js'
import { todayQuery } from '../schemas/today.js'
import { cycleService } from '../services/cycleService.js'

/**
 * /api/today — GET ?date=YYYY-MM-DD → TodaySnapshot (API_CONTRACT.md §6.4, G3).
 * @param {{ requireAuth: import('express').RequestHandler, service?: typeof cycleService }} deps
 */
export function createTodayRouter({ requireAuth, service = cycleService }) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    validate({ query: todayQuery }),
    asyncHandler(async (req, res) => {
      assertNotFuture(req.query.date, clientDate(req).latestAllowed, 'query', 'date')
      return ok(res, await service.getToday(req.supabase, req.query.date))
    }),
  )

  return router
}
