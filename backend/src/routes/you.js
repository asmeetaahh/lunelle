import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { ok } from '../lib/respond.js'
import { clientDate } from '../lib/clientDate.js'
import { youService } from '../services/youService.js'

/** API_ROUTES.you takes no query; anything supplied (e.g. user_id) is rejected. */
const youQuery = z.object({}).strict()

/**
 * /api/you — GET → YouSnapshot (API_CONTRACT.md §6.6, G3).
 * The user's calendar date comes from X-Client-Date (server UTC fallback).
 * @param {{ requireAuth: import('express').RequestHandler, service?: typeof youService }} deps
 */
export function createYouRouter({ requireAuth, service = youService }) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    validate({ query: youQuery }),
    asyncHandler(async (req, res) => ok(res, await service.getYou(req.supabase, clientDate(req).today))),
  )

  return router
}
