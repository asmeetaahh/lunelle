/**
 * pattern_evidence — the current assessment per (user_id, pattern_type, signal).
 *
 * Stores what the pattern engine produced, structurally. No summary prose, no
 * confidence maths, no AI. When a recompute drops a pattern to tier 'none' the
 * service calls `deleteForPattern` because 'none' is never persisted.
 */
import { PATTERN_EVIDENCE_COLUMNS, toPatternEvidenceRecord, toPatternEvidenceRow } from '../lib/mappers.js'
import { run } from './query.js'

const TABLE = 'pattern_evidence'
const CONFLICT_TARGET = 'user_id,pattern_type,signal'

/**
 * All persisted assessments for the caller, newest computation first, then by type and signal.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @returns {Promise<import('../lib/mappers.js').PatternEvidenceRecord[]>}
 */
export async function list(db) {
  const rows = await run(
    db
      .from(TABLE)
      .select(PATTERN_EVIDENCE_COLUMNS)
      .order('computed_at', { ascending: false })
      .order('pattern_type', { ascending: true })
      .order('signal', { ascending: true }),
  )
  return rows.map(toPatternEvidenceRecord)
}

/**
 * Insert-or-replace the assessment for one (pattern_type, signal).
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {import('../../../shared/types').PatternAssessment} assessment  tier must not be 'none'
 * @param {{ rangeStart: string|null, rangeEnd: string|null, computedAt: string }} meta
 * @returns {Promise<import('../lib/mappers.js').PatternEvidenceRecord>}
 */
export async function upsert(db, assessment, meta) {
  const row = await run(
    db.from(TABLE).upsert(toPatternEvidenceRow(assessment, meta), { onConflict: CONFLICT_TARGET }).select(PATTERN_EVIDENCE_COLUMNS).single(),
  )
  return toPatternEvidenceRecord(row)
}

/**
 * Bulk variant for a recompute: one round trip for all assessments. Rows share
 * the same column set by construction, which PostgREST requires.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {import('../../../shared/types').PatternAssessment[]} assessments
 * @param {{ rangeStart: string|null, rangeEnd: string|null, computedAt: string }} meta
 * @returns {Promise<import('../lib/mappers.js').PatternEvidenceRecord[]>}
 */
export async function upsertMany(db, assessments, meta) {
  if (assessments.length === 0) return []
  const rows = await run(
    db
      .from(TABLE)
      .upsert(assessments.map((a) => toPatternEvidenceRow(a, meta)), { onConflict: CONFLICT_TARGET })
      .select(PATTERN_EVIDENCE_COLUMNS),
  )
  return rows.map(toPatternEvidenceRecord)
}

/**
 * Remove the stored assessment for one pattern (used when it falls back to 'none').
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {'symptom'|'mood'} patternType
 * @param {string} signal
 * @returns {Promise<boolean>}  false when there was nothing to delete
 */
export async function deleteForPattern(db, patternType, signal) {
  const rows = await run(db.from(TABLE).delete().eq('pattern_type', patternType).eq('signal', signal).select('id'))
  return rows.length > 0
}
