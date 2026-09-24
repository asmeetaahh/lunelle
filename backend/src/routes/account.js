import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { noContent } from '../lib/respond.js'
import { deleteAccountBody } from '../schemas/account.js'

/** Database function from supabase/migrations/20260913150000_delete_own_account.sql (G1). */
export const DELETE_OWN_ACCOUNT_FN = 'delete_own_account'

/**
 * /api/account — DELETE (API_CONTRACT.md §6.2, G1).
 *
 * Invokes the SECURITY DEFINER function through the caller's own client, so
 * the only row it can ever remove is auth.uid(). No service role, no user id
 * from the request. All owned rows cascade in the database. The client signs
 * out locally afterwards.
 *
 * @param {{ requireAuth: import('express').RequestHandler, limiter?: import('express').RequestHandler }} deps
 */
export function createAccountRouter({ requireAuth, limiter }) {
  const router = Router()
  if (limiter) router.use(limiter)
  router.use(requireAuth)

  router.delete(
    '/',
    validate({ body: deleteAccountBody }),
    asyncHandler(async (req, res) => {
      const { error } = await req.supabase.rpc(DELETE_OWN_ACCOUNT_FN)
      if (error) throw error
      return noContent(res)
    }),
  )

  return router
}
