/**
 * cycle_settings — one row per user (UNIQUE user_id).
 *
 * Persists only its own table. Synchronising `lastPeriodStart` into
 * cycle_events is the service layer's job (API_CONTRACT.md §6.3).
 * The client passed in is the caller-scoped one (req.supabase); RLS scopes
 * every statement and `user_id DEFAULT auth.uid()` stamps inserts.
 */
import { CYCLE_SETTINGS_COLUMNS, toCycleSettings, toCycleSettingsRow } from '../lib/mappers.js'
import { run, requireFields } from './query.js'

const TABLE = 'cycle_settings'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @returns {Promise<import('../../../shared/types').CycleSettings | null>}  null = onboarding incomplete
 */
export async function get(db) {
  const row = await run(db.from(TABLE).select(CYCLE_SETTINGS_COLUMNS).maybeSingle())
  return row ? toCycleSettings(row) : null
}

/**
 * Insert-or-merge the user's single row. Only the supplied columns are written,
 * so omitted keys stay unchanged on an existing row and `null` clears.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {import('../../../shared/types').CycleSettingsInput} input
 * @returns {Promise<import('../../../shared/types').CycleSettings>}
 */
export async function upsert(db, input) {
  const payload = requireFields(toCycleSettingsRow(input), 'cycleSettings.upsert')
  const row = await run(db.from(TABLE).upsert(payload, { onConflict: 'user_id' }).select(CYCLE_SETTINGS_COLUMNS).single())
  return toCycleSettings(row)
}
