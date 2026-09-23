import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
import { ok } from '../lib/respond.js'
import { clientDate, assertNotFuture, addDays } from '../lib/clientDate.js'
import { observationBody, observationParams, observationsQuery } from '../schemas/observations.js'
import { DEFAULT_OBSERVATION_RANGE_DAYS } from '../schemas/common.js'
import * as observations from '../repositories/observations.js'

/**
 * /api/observations — PUT /:date, GET (API_CONTRACT.md §6.5, G6/G7).
 * Persistence only: no cycle day, no phase, no pattern maths, no AI.
 * @param {{ requireAuth: import('express').RequestHandler, repo?: typeof observations }} deps
 */
export function createObservationsRouter({ requireAuth, repo = observations }) {
  const router = Router()
  router.use(requireAuth)

  router.put(
    '/:date',
    validate({ params: observationParams, body: observationBody }),
    asyncHandler(async (req, res) => {
      assertNotFuture(req.params.date, clientDate(req).latestAllowed, 'params', 'date')
      return ok(res, await repo.upsertForDate(req.supabase, req.params.date, req.body))
    }),
  )

  router.get(
    '/',
    validate({ query: observationsQuery }),
    asyncHandler(async (req, res) => {
      const { today } = clientDate(req)
      const to = req.query.to ?? today
      const from = req.query.from ?? addDays(to, -DEFAULT_OBSERVATION_RANGE_DAYS)
      if (from > to) {
        throw new ApiError('validation_error', 'from must not be after to', [{ in: 'query', path: 'from', message: 'must not be after to' }])
      }
      return ok(res, await repo.list(req.supabase, { from, to }))
    }),
  )

  return router
}
