import { Router } from 'express'
import { asyncHandler, ApiError } from '../middleware/errorHandler.js'
import { ok } from '../lib/respond.js'
import * as subscription from '../repositories/subscription.js'

/**
 * /api/subscription — GET only (API_CONTRACT.md §6.7, G8).
 * There is deliberately no write route: entitlement is owned by the RevenueCat
 * webhook. Client-supplied isPlus/entitlement have nowhere to go.
 * @param {{ requireAuth: import('express').RequestHandler, repo?: typeof subscription }} deps
 */
export function createSubscriptionRouter({ requireAuth, repo = subscription }) {
  const router = Router()
  router.use(requireAuth)

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const state = await repo.get(req.supabase)
      // The signup trigger guarantees a row; its absence is a server-side invariant failure, not "free tier".
      if (!state) throw new ApiError('internal', 'Subscription state is missing for this account')
      return ok(res, state)
    }),
  )

  return router
}
