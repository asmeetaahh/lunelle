/**
 * daily_observations — one check-in per user per day (UNIQUE user_id, date).
 *
 * Pure persistence: no cycle day, no phase, no mood bucketing. A missing row
 * is returned as null, never as an empty observation — absence of a log is
 * not evidence of absence.
 */
import { OBSERVATION_COLUMNS, toObservation, toObservationRow } from '../lib/mappers.js'
import { run } from './query.js'

const TABLE = 'daily_observations'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} date
 * @returns {Promise<import('../../../shared/types').DailyObservation | null>}
 */
export async function getByDate(db, date) {
  const row = await run(db.from(TABLE).select(OBSERVATION_COLUMNS).eq('date', date).maybeSingle())
  return row ? toObservation(row) : null
}

/**
 * Idempotent upsert keyed on (user_id, date). Only supplied fields are written:
 * omitted keys stay unchanged on an existing row, `null` clears, and a new row
 * gets the column defaults (symptoms '{}', mood/energy/note null).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} date
 * @param {import('../../../shared/types').DailyObservationInput} input
 * @returns {Promise<import('../../../shared/types').DailyObservation>}
 */
export async function upsertForDate(db, date, input) {
  const payload = { date, ...toObservationRow(input) }
  const row = await run(db.from(TABLE).upsert(payload, { onConflict: 'user_id,date' }).select(OBSERVATION_COLUMNS).single())
  return toObservation(row)
}

/**
 * Observations ascending by date, optionally bounded (inclusive).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ from?: string, to?: string }} [range]
 * @returns {Promise<import('../../../shared/types').DailyObservation[]>}
 */
export async function list(db, { from, to } = {}) {
  let query = db.from(TABLE).select(OBSERVATION_COLUMNS)
  if (from !== undefined) query = query.gte('date', from)
  if (to !== undefined) query = query.lte('date', to)
  const rows = await run(query.order('date', { ascending: true }))
  return rows.map(toObservation)
}
