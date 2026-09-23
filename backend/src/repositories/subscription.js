/**
 * subscription_state — read-only for users (G8).
 *
 * The caller-scoped client can only SELECT this table (no insert/update/delete
 * grant or policy). Writes belong to the future RevenueCat webhook, which will
 * live in its own module with the service-role client — not here.
 */
import { SUBSCRIPTION_COLUMNS, toSubscriptionState } from '../lib/mappers.js'
import { run } from './query.js'

const TABLE = 'subscription_state'

/**
 * The caller's entitlement row. The signup trigger creates it, so null means
 * something upstream failed rather than "free tier".
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @returns {Promise<import('../../../shared/types').SubscriptionState | null>}
 */
export async function get(db) {
  const row = await run(db.from(TABLE).select(SUBSCRIPTION_COLUMNS).maybeSingle())
  return row ? toSubscriptionState(row) : null
}
