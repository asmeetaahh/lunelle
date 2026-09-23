import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
import { ok, created, noContent } from '../lib/respond.js'
import { clientDate, assertNotFuture } from '../lib/clientDate.js'
import { cycleEventBody, cycleEventsQuery, cycleEventParams } from '../schemas/cycleEvents.js'
import * as cycleEvents from '../repositories/cycleEvents.js'

/**
 * /api/cycle-events — GET, POST, DELETE /:id (API_CONTRACT.md §6.5, G5).
 * @param {{ requireAuth: import('express').RequestHandler, repo?: typeof cycleEvents }} deps
 */
export function createCycleEventsRouter({ requireAuth, repo = cycleEvents }) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    validate({ query: cycleEventsQuery }),
    asyncHandler(async (req, res) => ok(res, await repo.list(req.supabase, req.query))),
  )

  router.post(
    '/',
    validate({ body: cycleEventBody }),
    asyncHandler(async (req, res) => {
      assertNotFuture(req.body.date, clientDate(req).latestAllowed, 'body', 'date')
      // A duplicate (type, date) raises 23505 from the repository → 409 conflict via the error handler.
      return created(res, await repo.insert(req.supabase, req.body))
    }),
  )

  router.delete(
    '/:id',
    validate({ params: cycleEventParams }),
    asyncHandler(async (req, res) => {
      const deleted = await repo.deleteById(req.supabase, req.params.id)
      // Absent and not-owned are the same answer: RLS hides the row either way.
      if (!deleted) throw new ApiError('not_found', 'Cycle event not found')
      return noContent(res)
    }),
  )

  return router
}
