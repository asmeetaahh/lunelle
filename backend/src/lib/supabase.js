import { createClient } from '@supabase/supabase-js'
import { getConfig } from '../config/env.js'

// Server-side clients never persist sessions or touch browser storage.
const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

/**
 * Supabase client that acts AS the calling user.
 *
 * Built with the anon key plus the caller's access token, so every query runs
 * under Postgres role `authenticated` with `auth.uid()` = the caller. Row Level
 * Security applies exactly as it would from the mobile app — this is the only
 * client normal request handlers may use.
 *
 * @param {string} accessToken  raw Supabase JWT from `Authorization: Bearer <token>`
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserClient(accessToken) {
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new TypeError('createUserClient requires a non-empty access token')
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig()

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/**
 * Supabase client with the service-role key. It BYPASSES Row Level Security.
 *
 * FORBIDDEN in any code path that handles an authenticated user request.
 * Its only intended caller is the future RevenueCat webhook, which has no user
 * session and must write `entitlements` rows on behalf of the system.
 * Never attach this client to `req`, never pass it to route handlers, and never
 * import it from `middleware/` or `routes/`.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServiceClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig()

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: serverAuthOptions,
  })
}
