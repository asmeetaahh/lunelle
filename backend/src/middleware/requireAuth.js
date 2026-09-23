import { createUserClient } from '../lib/supabase.js'

// `Bearer <token>` — token must be a single non-empty run of non-whitespace.
const BEARER_PATTERN = /^Bearer\s+(\S+)$/i

function reject(res, status, code, message) {
  if (status === 401) res.set('WWW-Authenticate', 'Bearer')
  return res.status(status).json({ success: false, code, message })
}

/**
 * Build the auth middleware. The factory exists so tests can inject a fake
 * client builder; production code should import `requireAuth` below.
 *
 * On success the request gains:
 *   req.user     — the Supabase user verified from the token (identity source of truth)
 *   req.supabase — a user-scoped client; every query it runs is subject to RLS
 *
 * Identity always comes from the verified token. Any `user_id`, `userId`, or
 * `user` in the body, query, or headers is ignored — handlers must use `req.user.id`.
 *
 * @param {{ createUserClient?: (accessToken: string) => import('@supabase/supabase-js').SupabaseClient }} [deps]
 */
export function createRequireAuth({ createUserClient: buildClient = createUserClient } = {}) {
  return async function requireAuth(req, res, next) {
    const header = req.get('authorization')

    if (!header) {
      return reject(res, 401, 'missing_authorization', 'Authorization header is required')
    }

    const match = BEARER_PATTERN.exec(header.trim())
    if (!match) {
      return reject(res, 401, 'malformed_authorization', 'Authorization header must be "Bearer <token>"')
    }

    const accessToken = match[1]

    let supabase
    let result
    try {
      supabase = buildClient(accessToken)
      // Pass the token explicitly: with persistSession off there is no stored session to fall back on.
      result = await supabase.auth.getUser(accessToken)
    } catch {
      // Could not reach Supabase Auth — not the caller's fault, so don't call the token invalid.
      return reject(res, 503, 'auth_unavailable', 'Authentication service is unavailable')
    }

    if (result.error || !result.data?.user) {
      return reject(res, 401, 'invalid_token', 'Access token is invalid or expired')
    }

    req.user = result.data.user
    req.supabase = supabase
    return next()
  }
}

export const requireAuth = createRequireAuth()
