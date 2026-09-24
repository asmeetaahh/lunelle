/**
 * "You" orchestration — cycle statistics, cycle history and pattern evidence
 * (API_CONTRACT.md §6.6, §8, G3).
 *
 * Reuses cycleService.buildCycleInput and the two pure engines; there is no
 * second cycle or pattern calculation here. Deterministic given the database
 * rows, `asOfDate` and the injected server clock (used only for computed_at).
 * No HTTP, no AI, no service-role client.
 *
 * Query order (fixed):
 *   1. cycleSettings.get
 *   2. cycleEvents.list        { to: asOfDate }          (both event types)
 *   3. observations.list       { to: asOfDate }
 *   4. patternEvidence.list
 *   5. patternEvidence.upsertMany       — only for assessments that changed
 *   6. patternEvidence.deleteForPattern — only for stored patterns the engine now scores 'none'
 *
 * Date semantics:
 *   asOfDate   — the user's local calendar date; decides the current cycle,
 *                which events/observations exist yet, and pattern windows.
 *   computedAt — server UTC timestamp for pattern_evidence.computed_at; comes
 *                from the injected clock, never from asOfDate.
 */
import * as cycleSettingsRepo from '../repositories/cycleSettings.js'
import * as cycleEventsRepo from '../repositories/cycleEvents.js'
import * as observationsRepo from '../repositories/observations.js'
import * as patternEvidenceRepo from '../repositories/patternEvidence.js'
import { computeCycleStats, daysBetween, MIN_PLAUSIBLE_CYCLE_LENGTH, MAX_PLAUSIBLE_CYCLE_LENGTH } from '../engines/cycle.js'
import { assessAllPatterns, assessPattern, moodBucketFor, PatternEngineError } from '../engines/patternConfidence.js'
import { addDays } from '../lib/clientDate.js'
import { buildCycleInput } from './cycleService.js'

/** Fields of a persisted record that must equal the fresh assessment for a write to be skipped. */
export const EVIDENCE_COMPARE_KEYS = Object.freeze(['phase', 'confidenceTier', 'supportingCycles', 'assessableCycles', 'consistency', 'evidence', 'rangeStart', 'rangeEnd'])

/** JSON with recursively sorted object keys, so jsonb key reordering cannot fake a change. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const patternKey = (kind, key) => `${kind}:${key}`

/**
 * Cycle history from period_start / period_end events (newest first).
 * Nothing is fabricated: unknown ends and lengths are null.
 *
 * @param {import('../../../shared/types').CycleEvent[]} events  already bounded to asOfDate
 * @param {string} asOfDate
 * @returns {import('../../../shared/types').CycleSummary[]}
 */
export function buildCycleSummaries(events, asOfDate) {
  const starts = [...new Set(events.filter((e) => e.type === 'period_start' && e.date <= asOfDate).map((e) => e.date))].sort()
  const ends = [...new Set(events.filter((e) => e.type === 'period_end' && e.date <= asOfDate).map((e) => e.date))].sort()

  const summaries = starts.map((startDate, i) => {
    const nextStart = starts[i + 1]
    const endDate = nextStart ? addDays(nextStart, -1) : null
    const periodEnd = ends.find((d) => d >= startDate && (nextStart === undefined || d < nextStart))
    return {
      startDate,
      endDate,
      cycleLength: nextStart ? daysBetween(startDate, nextStart) : null,
      periodLength: periodEnd ? daysBetween(startDate, periodEnd) + 1 : null,
      isCurrent: nextStart === undefined,
    }
  })
  return summaries.reverse()
}

/**
 * Pattern-engine input from summaries and observations.
 *
 * Observations: each symptom becomes a 'symptom' observation (key passed
 * through); a non-null mood becomes one 'mood' observation keyed by
 * moodBucketFor. Energy has no pattern target in V2 and is not converted.
 * A day with no observation produces nothing — absence of a log is not data.
 *
 * Windows: one per cycle, oldest first. Completed cycles pass their actual
 * length; the open cycle passes the stats' typical length. Completed cycles
 * whose length is outside the plausible range (a logging gap, not a cycle) are
 * left out, matching computeCycleStats which discards those intervals.
 *
 * @param {import('../../../shared/types').CycleSummary[]} summaries  newest first
 * @param {import('../../../shared/types').DailyObservation[]} observations  already bounded to asOfDate
 * @param {number} typicalLength
 * @param {string} asOfDate
 */
export function buildPatternInput(summaries, observations, typicalLength, asOfDate) {
  const engineObservations = []
  for (const o of observations) {
    if (o.date > asOfDate) continue
    for (const key of o.symptoms ?? []) engineObservations.push({ date: o.date, kind: 'symptom', key })
    if (o.mood !== null && o.mood !== undefined) engineObservations.push({ date: o.date, kind: 'mood', key: moodBucketFor(o.mood), intensity: o.mood })
  }

  const cycles = []
  for (const s of [...summaries].reverse()) {
    const completed = s.endDate !== null
    if (completed && (s.cycleLength < MIN_PLAUSIBLE_CYCLE_LENGTH || s.cycleLength > MAX_PLAUSIBLE_CYCLE_LENGTH)) continue
    const windowEnd = s.endDate ?? asOfDate
    cycles.push({
      index: cycles.length,
      startDate: s.startDate,
      endDate: s.endDate,
      typicalLength: completed ? s.cycleLength : typicalLength,
      loggedDays: observations.filter((o) => o.date >= s.startDate && o.date <= windowEnd).length,
    })
  }

  return { observations: engineObservations, cycles }
}

/**
 * @param {{
 *   cycleSettings?: typeof cycleSettingsRepo,
 *   cycleEvents?: typeof cycleEventsRepo,
 *   observations?: typeof observationsRepo,
 *   patternEvidence?: typeof patternEvidenceRepo,
 *   now?: () => Date,
 * }} [deps]
 */
export function createYouService({
  cycleSettings = cycleSettingsRepo,
  cycleEvents = cycleEventsRepo,
  observations = observationsRepo,
  patternEvidence = patternEvidenceRepo,
  now = () => new Date(),
} = {}) {
  /**
   * Bring pattern_evidence in line with the engine's current output.
   * Upserts changed non-none assessments in one call; deletes stored patterns
   * the engine now scores 'none'. Unchanged rows are left alone.
   */
  async function syncPatternEvidence(db, input, assessments, range, computedAt) {
    const stored = await patternEvidence.list(db)
    const storedByKey = new Map(stored.map((r) => [patternKey(r.patternType, r.signal), r]))
    const currentByKey = new Map(assessments.map((a) => [patternKey(a.target.kind, a.target.key), a]))

    const toUpsert = assessments.filter((a) => {
      if (a.tier === 'none') return false
      const existing = storedByKey.get(patternKey(a.target.kind, a.target.key))
      if (!existing) return true
      const fresh = { ...a, phase: a.dominantPhase, confidenceTier: a.tier, rangeStart: range.start, rangeEnd: range.end }
      return EVIDENCE_COMPARE_KEYS.some((key) => stableStringify(existing[key]) !== stableStringify(fresh[key]))
    })

    const toDelete = []
    for (const record of stored) {
      const key = patternKey(record.patternType, record.signal)
      const current = currentByKey.get(key)
      if (current) {
        if (current.tier === 'none') toDelete.push(record)
        continue
      }
      // Not among the observed targets: ask the engine explicitly so the decision is its verdict.
      try {
        if (assessPattern(input, { kind: record.patternType, key: record.signal }).tier === 'none') toDelete.push(record)
      } catch (error) {
        if (!(error instanceof PatternEngineError)) throw error
        toDelete.push(record) // no longer a supported target → cannot be current evidence
      }
    }

    if (toUpsert.length > 0) await patternEvidence.upsertMany(db, toUpsert, { rangeStart: range.start, rangeEnd: range.end, computedAt })
    for (const record of toDelete) await patternEvidence.deleteForPattern(db, record.patternType, record.signal)
    return { upserted: toUpsert.length, deleted: toDelete.length }
  }

  return {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} db  caller-scoped client
     * @param {string} asOfDate  device-local "YYYY-MM-DD", validated upstream
     * @param {{ computedAt?: string }} [options]  override the server timestamp (tests)
     * @returns {Promise<import('../../../shared/types').YouSnapshot>}
     */
    async getYou(db, asOfDate, options = {}) {
      const settings = await cycleSettings.get(db)
      const events = await cycleEvents.list(db, { to: asOfDate })
      const allObservations = await observations.list(db, { to: asOfDate })

      const stats = computeCycleStats(buildCycleInput(settings, events, asOfDate))
      const cycles = buildCycleSummaries(events, asOfDate)
      const input = buildPatternInput(cycles, allObservations, stats.typicalLength, asOfDate)
      const assessments = assessAllPatterns(input)

      const completedWindows = input.cycles.filter((c) => c.endDate !== null)
      const range = completedWindows.length
        ? { start: completedWindows[0].startDate, end: completedWindows[completedWindows.length - 1].endDate }
        : { start: null, end: null }
      const computedAt = options.computedAt ?? now().toISOString()

      await syncPatternEvidence(db, input, assessments, range, computedAt)

      return {
        stats,
        cycles,
        patterns: assessments.filter((a) => a.tier !== 'none'),
      }
    },
  }
}

export const youService = createYouService()
