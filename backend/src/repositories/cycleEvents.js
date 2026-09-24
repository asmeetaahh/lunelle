/**
 * cycle_events — period_start / period_end events (G5).
 *
 * UNIQUE (user_id, type, date): a duplicate insert raises 23505, which is
 * thrown unchanged for the error handler to turn into 409 conflict.
 */
import { CYCLE_EVENT_COLUMNS, toCycleEvent, toCycleEventRow } from '../lib/mappers.js'
import { run } from './query.js'

const TABLE = 'cycle_events'

/**
 * Events ascending by date (then type), optionally bounded and/or filtered by type.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ from?: string, to?: string, type?: 'period_start' | 'period_end' }} [range]
 * @returns {Promise<import('../../../shared/types').CycleEvent[]>}
 */
export async function list(db, { from, to, type } = {}) {
  let query = db.from(TABLE).select(CYCLE_EVENT_COLUMNS)
  if (from !== undefined) query = query.gte('date', from)
  if (to !== undefined) query = query.lte('date', to)
  if (type !== undefined) query = query.eq('type', type)
  const rows = await run(query.order('date', { ascending: true }).order('type', { ascending: true }))
  return rows.map(toCycleEvent)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} id
 * @returns {Promise<import('../../../shared/types').CycleEvent | null>}  null when absent or not owned
 */
export async function getById(db, id) {
  const row = await run(db.from(TABLE).select(CYCLE_EVENT_COLUMNS).eq('id', id).maybeSingle())
  return row ? toCycleEvent(row) : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {import('../../../shared/types').CycleEventInput} input  only type and date are written
 * @returns {Promise<import('../../../shared/types').CycleEvent>}
 */
export async function insert(db, input) {
  const row = await run(db.from(TABLE).insert(toCycleEventRow(input)).select(CYCLE_EVENT_COLUMNS).single())
  return toCycleEvent(row)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} id
 * @returns {Promise<boolean>}  false when nothing was deleted (absent or not owned — RLS hides both)
 */
export async function deleteById(db, id) {
  const rows = await run(db.from(TABLE).delete().eq('id', id).select('id'))
  return rows.length > 0
}
