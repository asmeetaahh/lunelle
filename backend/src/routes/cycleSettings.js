import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { ok } from '../lib/respond.js'
import { clientDate, assertNotFuture } from '../lib/clientDate.js'
import { cycleSettingsBody } from '../schemas/cycleSettings.js'
import { cycleSettingsService } from '../services/cycleSettingsService.js'

/**
 * /api/cycle-settings — GET, PUT (API_CONTRACT.md §6.3).
 * @param {{ requireAuth: import('express').RequestHandler, service?: typeof cycleSettingsService }} deps
 */
export function createCycleSettingsRouter({ requireAuth, service = cycleSettingsService }) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    asyncHandler(async (req, res) => ok(res, await service.get(req.supabase))),
  )

  router.put(
    '/',
    validate({ body: cycleSettingsBody }),
    asyncHandler(async (req, res) => {
      if (typeof req.body.lastPeriodStart === 'string') {
        assertNotFuture(req.body.lastPeriodStart, clientDate(req).latestAllowed, 'body', 'lastPeriodStart')
      }
      const { settings } = await service.upsert(req.supabase, req.body)
      return ok(res, settings)
    }),
  )

  return router
}
