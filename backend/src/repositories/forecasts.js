/**
 * forecasts — append-only snapshots (G10).
 *
 * This module deliberately has no update or delete: a snapshot is history.
 * "Active" is simply the newest row; older rows are superseded by ordering.
 * The service layer computes a fresh forecast, compares it with `latest()`,
 * and calls `insert()` only when it differs. Nothing here calculates anything.
 */
import { FORECAST_COLUMNS, toForecastSnapshot, toForecastRow } from '../lib/mappers.js'
import { run } from './query.js'

const TABLE = 'forecasts'

/**
 * Newest snapshot by generated_at, or null when none has been persisted.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @returns {Promise<import('../lib/mappers.js').ForecastSnapshot | null>}
 */
export async function latest(db) {
  const row = await run(db.from(TABLE).select(FORECAST_COLUMNS).order('generated_at', { ascending: false }).limit(1).maybeSingle())
  return row ? toForecastSnapshot(row) : null
}

/**
 * Append one snapshot. Every field is required; generated_at is set by the database.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {Omit<import('../lib/mappers.js').ForecastSnapshot, 'id' | 'generatedAt'>} snapshot
 * @returns {Promise<import('../lib/mappers.js').ForecastSnapshot>}
 */
export async function insert(db, snapshot) {
  const row = await run(db.from(TABLE).insert(toForecastRow(snapshot)).select(FORECAST_COLUMNS).single())
  return toForecastSnapshot(row)
}

/**
 * Snapshot history, newest first.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ limit?: number }} [options]
 * @returns {Promise<import('../lib/mappers.js').ForecastSnapshot[]>}
 */
export async function list(db, { limit = 20 } = {}) {
  const rows = await run(db.from(TABLE).select(FORECAST_COLUMNS).order('generated_at', { ascending: false }).limit(limit))
  return rows.map(toForecastSnapshot)
}
