/**
 * journal_entries — private free text (G2).
 *
 * No mood/symptom columns exist on this table; nothing is duplicated here.
 * Cycle day / phase for an entry are derived at read time by the service.
 */
import { JOURNAL_COLUMNS, toJournalEntry, toJournalEntryRow } from '../lib/mappers.js'
import { run, requireFields } from './query.js'

const TABLE = 'journal_entries'

/**
 * Entries newest first (entry_date desc, created_at desc — matches the index), optionally bounded.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ from?: string, to?: string, limit?: number }} [range]
 * @returns {Promise<import('../../../shared/types').JournalEntry[]>}
 */
export async function list(db, { from, to, limit } = {}) {
  let query = db.from(TABLE).select(JOURNAL_COLUMNS)
  if (from !== undefined) query = query.gte('entry_date', from)
  if (to !== undefined) query = query.lte('entry_date', to)
  query = query.order('entry_date', { ascending: false }).order('created_at', { ascending: false })
  if (limit !== undefined) query = query.limit(limit)
  const rows = await run(query)
  return rows.map(toJournalEntry)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} id
 * @returns {Promise<import('../../../shared/types').JournalEntry | null>}
 */
export async function getById(db, id) {
  const row = await run(db.from(TABLE).select(JOURNAL_COLUMNS).eq('id', id).maybeSingle())
  return row ? toJournalEntry(row) : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {import('../../../shared/types').JournalEntryInput} input  entryDate omitted → DB default (server date); the service should always pass the device-local date
 * @returns {Promise<import('../../../shared/types').JournalEntry>}
 */
export async function create(db, input) {
  const row = await run(db.from(TABLE).insert(toJournalEntryRow(input)).select(JOURNAL_COLUMNS).single())
  return toJournalEntry(row)
}

/**
 * Partial update; omitted keys unchanged, `null` clears (title only — body is NOT NULL and the DB rejects null).
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} id
 * @param {Partial<import('../../../shared/types').JournalEntryInput>} input
 * @returns {Promise<import('../../../shared/types').JournalEntry | null>}  null when absent or not owned
 */
export async function update(db, id, input) {
  const payload = requireFields(toJournalEntryRow(input), 'journal.update')
  const row = await run(db.from(TABLE).update(payload).eq('id', id).select(JOURNAL_COLUMNS).maybeSingle())
  return row ? toJournalEntry(row) : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} id
 * @returns {Promise<boolean>}  false when nothing was deleted
 */
export async function remove(db, id) {
  const rows = await run(db.from(TABLE).delete().eq('id', id).select('id'))
  return rows.length > 0
}

export { remove as delete }
