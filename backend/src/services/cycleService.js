/**
 * Cycle orchestration — the only place engines, repositories and the forecast
 * persistence rule meet (API_CONTRACT.md §6.4, §7.5, G3, G10).
 *
 * Deterministic given the database rows and `asOfDate`; never reads a clock.
 * No HTTP, no AI, no service-role client. The only write it can ever perform
 * is appending a genuinely new forecast snapshot.
 *
 * Query order (fixed, so callers and tests can reason about it):
 *   1. cycleSettings.get
 *   2. cycleEvents.list  { type: 'period_start', to: asOfDate }
 *   3. observations.list (all)
 *   4. forecasts.latest   — only when a personalised forecast exists
 *   5. forecasts.insert   — only when it differs from the latest snapshot
 */
import * as cycleSettingsRepo from '../repositories/cycleSettings.js'
import * as cycleEventsRepo from '../repositories/cycleEvents.js'
import * as forecastsRepo from '../repositories/forecasts.js'
import * as observationsRepo from '../repositories/observations.js'
import { computeCycleStats, locateCycleDay, forecastCycles, daysBetween, MODEL_VERSION } from '../engines/cycle.js'

/**
 * CycleStats.lengthSource → persisted/wire ForecastBasis (frozen mapping).
 * 'default' has no basis: the 28-day fallback may position a phase but is never a forecast.
 * 'calibrated' is reserved and has no engine path.
 */
export const BASIS_FOR_LENGTH_SOURCE = Object.freeze({
  reported: 'user_reported',
  history: 'observed_cycle',
  default: null,
})

/** The seven persisted values plus the model version; any difference means a new snapshot. */
export const SNAPSHOT_COMPARE_KEYS = Object.freeze([
  'windowStart',
  'windowEnd',
  'expectedPeriodDate',
  'periodUncertaintyDays',
  'windowOffsetUncertaintyDays',
  'basis',
  'modelVersion',
])

const LAST_N_DAYS = 30

/**
 * The single way period-start history and settings become engine input.
 * Shared by cycleService and youService so both compute identical CycleStats.
 *
 * Only `period_start` events on or before `asOfDate` count; a future-dated
 * start can never become the current cycle. Reported values are passed only
 * when non-null so the engine's 'reported' path is never triggered by a null.
 *
 * @param {import('../../../shared/types').CycleSettings | null} settings
 * @param {import('../../../shared/types').CycleEvent[]} events
 * @param {string} asOfDate
 * @returns {import('../engines/cycle.js').CycleHistoryInput}
 */
export function buildCycleInput(settings, events, asOfDate) {
  const input = {
    periodStartDates: events.filter((e) => e.type === 'period_start' && e.date <= asOfDate).map((e) => e.date),
  }
  if (settings?.reportedCycleLength != null) input.reportedCycleLength = settings.reportedCycleLength
  if (settings?.reportedPeriodLength != null) input.reportedPeriodLength = settings.reportedPeriodLength
  return input
}

/**
 * @param {{
 *   cycleSettings?: typeof cycleSettingsRepo,
 *   cycleEvents?: typeof cycleEventsRepo,
 *   forecasts?: typeof forecastsRepo,
 *   observations?: typeof observationsRepo,
 *   modelVersion?: string,
 * }} [deps]
 */
export function createCycleService({
  cycleSettings = cycleSettingsRepo,
  cycleEvents = cycleEventsRepo,
  forecasts = forecastsRepo,
  observations = observationsRepo,
  modelVersion = MODEL_VERSION,
} = {}) {
  /**
   * Persist the next-period window if it differs from the newest stored snapshot.
   * Never updates or deletes; returns whether a row was appended.
   */
  async function persistIfChanged(db, snapshot) {
    const latest = await forecasts.latest(db)
    const identical = latest !== null && SNAPSHOT_COMPARE_KEYS.every((key) => latest[key] === snapshot[key])
    if (identical) return false
    await forecasts.insert(db, snapshot)
    return true
  }

  return {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} db  caller-scoped client
     * @param {string} asOfDate  device-local "YYYY-MM-DD", already validated as a real, non-future day
     * @returns {Promise<import('../../../shared/types').TodaySnapshot>}
     */
    async getToday(db, asOfDate) {
      const settings = await cycleSettings.get(db)
      const events = await cycleEvents.list(db, { type: 'period_start', to: asOfDate })
      const allObservations = await observations.list(db)

      // The repository already bounds the query; buildCycleInput filters again so a
      // future-dated start can never become "the current cycle" even if a caller widens it.
      const input = buildCycleInput(settings, events, asOfDate)
      const stats = computeCycleStats(input)
      const position = locateCycleDay(input, asOfDate)
      const forecast = forecastCycles(input, { asOfDate })

      const basis = BASIS_FOR_LENGTH_SOURCE[stats.lengthSource] ?? null
      const [first] = forecast.predictedPeriods
      let nextPeriod = null
      let forecastBasis = null

      // A personalised forecast exists only with a real basis AND a start on/before asOfDate
      // (the engine yields no periods otherwise). Nothing else touches the forecasts table.
      if (basis !== null && first !== undefined) {
        nextPeriod = first // always the fresh engine result, never the stored row
        forecastBasis = basis
        await persistIfChanged(db, {
          windowStart: first.earliestStart,
          windowEnd: first.latestStart,
          expectedPeriodDate: first.expectedStart,
          periodUncertaintyDays: first.uncertaintyDays,
          windowOffsetUncertaintyDays: forecast.windowOffsetUncertaintyDays,
          basis,
          modelVersion,
        })
      }

      let last30 = 0
      let todayObservation = null
      for (const observation of allObservations) {
        const age = daysBetween(observation.date, asOfDate) // 0 = asOfDate itself
        if (age >= 0 && age < LAST_N_DAYS) last30 += 1
        if (age === 0) todayObservation = observation
      }

      return {
        date: asOfDate,
        hasCycleSettings: settings !== null,
        position,
        nextPeriod,
        forecastBasis,
        caveats: forecast.caveats,
        loggedDays: { total: allObservations.length, last30 },
        todayObservation,
      }
    },
  }
}

export const cycleService = createCycleService()
