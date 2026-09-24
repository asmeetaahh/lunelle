/**
 * Cycle forecast engine — PURE and DETERMINISTIC.
 *
 * Invariants (hold for every export):
 *   - No I/O: never imports Supabase, never fetches, never reads process.env.
 *   - No clock: never calls Date.now() / new Date() without an argument.
 *     "Today" is always the caller-supplied `asOfDate`.
 *   - Same input → same output, byte for byte.
 *   - Inputs are never mutated.
 *   - Every date in and out is a calendar `ISODate` ("YYYY-MM-DD"); no time zones.
 *   - Uncertainty is always explicit: a forecast is a window plus a confidence, never a bare date.
 *   - No fabricated forecast: when the typical length would have to come from
 *     DEFAULT_CYCLE_LENGTH (`lengthSource === 'default'`), no period is predicted.
 *   - Nothing here is a diagnosis. An overdue period yields `phase: 'unknown'`, not a guess.
 *
 * Persistence is the caller's job. `model_version` (MODEL_VERSION below) is
 * supplied by the orchestration layer when it writes a `forecasts` row.
 */

/** @typedef {string} ISODate  Calendar date "YYYY-MM-DD" */

/** @typedef {'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown'} Phase */

/** @typedef {'insufficient' | 'regular' | 'somewhat_irregular' | 'irregular'} Regularity */

/** @typedef {'history' | 'reported' | 'default'} LengthSource */

/** @typedef {'low' | 'medium' | 'high'} Confidence */

/**
 * @typedef {Object} CycleHistoryInput
 * @property {ISODate[]} periodStartDates
 *   Period start dates in any order. Duplicates are ignored. May be empty.
 * @property {number} [reportedCycleLength]
 *   User-reported typical cycle length in days. Used as the fallback when
 *   history holds fewer than `MIN_CYCLES_FOR_HISTORY` completed cycles.
 * @property {number} [reportedPeriodLength]
 *   User-reported typical bleeding length in days. Fallback for the menstrual phase length.
 */

/**
 * @typedef {Object} CycleStats
 * @property {number[]} cycleLengths      Completed cycle lengths in days, oldest → newest,
 *                                        limited to the last `MAX_HISTORY_CYCLES`. Lengths outside
 *                                        [MIN_PLAUSIBLE_CYCLE_LENGTH, MAX_PLAUSIBLE_CYCLE_LENGTH] are excluded.
 * @property {number} sampleSize          `cycleLengths.length`
 * @property {number} typicalLength       Length used for forecasting (rounded median of history, else reported, else DEFAULT_CYCLE_LENGTH)
 * @property {LengthSource} lengthSource  Where `typicalLength` came from
 * @property {number|null} meanLength     null when sampleSize is 0; rounded to 2 decimals
 * @property {number|null} stdDev         Population standard deviation, 2 decimals; null when sampleSize < 2
 * @property {Regularity} regularity      'insufficient' below MIN_CYCLES_FOR_HISTORY, else bucketed by stdDev
 * @property {ISODate|null} lastPeriodStart  Most recent start date supplied, regardless of asOfDate
 */

/**
 * @typedef {Object} PredictedPeriod
 * @property {number} ordinal               1 = next period, 2 = the one after, …
 * @property {ISODate} expectedStart
 * @property {ISODate} earliestStart        expectedStart minus uncertainty; never after expectedStart
 * @property {ISODate} latestStart          expectedStart plus uncertainty; never before expectedStart
 * @property {number} uncertaintyDays       Half-width of the window; grows with ordinal and irregularity
 * @property {Confidence} confidence
 */

/**
 * @typedef {Object} Forecast
 * @property {ISODate} asOfDate
 * @property {PredictedPeriod[]} predictedPeriods  Ordered by ordinal. Empty when no legitimate basis exists.
 *                                                 Ordinal 1 is always present when a forecast exists, even if
 *                                                 its window is already past (overdue); later ordinals only
 *                                                 while their window touches [asOfDate, asOfDate + horizonDays].
 * @property {CycleStats} basis
 * @property {number} windowOffsetUncertaintyDays  Engine-level, not on the wire: the irregularity slack that is
 *                                                 already folded into every `uncertaintyDays`. Persist it as
 *                                                 forecasts.window_offset_uncertainty_days; the period-date
 *                                                 uncertainty alone is `uncertaintyDays - windowOffsetUncertaintyDays`.
 * @property {string[]} caveats                    Plain-language notes; always shown to the user
 */

/**
 * @typedef {Object} CyclePosition
 * @property {number|null} cycleDay        1-based day of the current cycle; null when there is no history on or before asOfDate
 * @property {Phase} phase                 'unknown' when there is no history, or when the period is overdue
 * @property {number} typicalLength        Cycle length the phase boundaries were derived from
 * @property {boolean} isOverdue           asOfDate is past the latest predicted start of the next period (false when nothing is predicted)
 * @property {boolean} isEstimated         Phase boundaries came from a fallback length, not history
 * @property {Confidence} confidence
 */

/** Version tag the orchestration layer stores in forecasts.model_version. Bump on any behavioural change. */
export const MODEL_VERSION = 'cycle-1'

export const DEFAULT_CYCLE_LENGTH = 28
export const DEFAULT_PERIOD_LENGTH = 5
export const MIN_PLAUSIBLE_CYCLE_LENGTH = 15
export const MAX_PLAUSIBLE_CYCLE_LENGTH = 60
export const MIN_CYCLES_FOR_HISTORY = 3
export const MAX_HISTORY_CYCLES = 12
export const DEFAULT_FORECAST_HORIZON_DAYS = 90

/** Fixed luteal length used to place the ovulatory window (typicalLength − LUTEAL_PHASE_LENGTH). */
export const LUTEAL_PHASE_LENGTH = 14

/** stdDev (days) at or above which a history is bucketed into the given regularity. */
export const REGULARITY_THRESHOLDS = Object.freeze({
  somewhat_irregular: 4,
  irregular: 8,
})

/**
 * How window half-widths are built. `base` applies to ordinal 1, `growth` is
 * added per further ordinal, and `offset` is extra slack for irregular history
 * (reported separately as Forecast.windowOffsetUncertaintyDays).
 */
export const UNCERTAINTY_MODEL = Object.freeze({
  history: Object.freeze({ minBase: 1, minGrowth: 1 }),
  reported: Object.freeze({ base: 3, growth: 2 }),
  offsetDays: Object.freeze({ regular: 0, somewhat_irregular: 1, irregular: 3 }),
})

/** Every caveat the engine can emit, so the API and tests can match on them. */
export const CAVEATS = Object.freeze({
  noBasis: 'No forecast yet. Add your typical cycle length or log a period start to get one.',
  noStartBeforeDate: 'No period start has been logged on or before this date, so there is nothing to forecast from.',
  reported: 'Based on your reported cycle length. Forecasts improve after three logged cycles.',
  somewhatIrregular: 'Your recent cycles vary a little, so the window is wider than usual.',
  irregular: 'Your recent cycles vary a lot, so this window is wide and confidence is low.',
  /** @param {number} days */
  overdue: (days) => `Your period is ${days} day${days === 1 ? '' : 's'} past the predicted window. Log it when it starts.`,
})

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export class CycleEngineError extends Error {
  /**
   * @param {'invalid_input'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'CycleEngineError'
    this.code = code
  }
}

/**
 * True when `value` is a syntactically valid calendar date string and the
 * calendar accepts it (rejects "2026-02-30").
 * @param {unknown} value
 * @returns {value is ISODate}
 */
export function isISODate(value) {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

// ---------------------------------------------------------------------------
// Date arithmetic — pure integer calendar maths on the proleptic Gregorian
// calendar. No Date objects anywhere in this module, so there is nothing that
// could read a clock or a time zone. Day numbers count days since 1970-01-01.
// ---------------------------------------------------------------------------

const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** Days since 1970-01-01 for a civil date (Howard Hinnant's days_from_civil). */
function dayNumberFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Civil date for a day number (Howard Hinnant's civil_from_days). */
function civilFromDayNumber(dayNumber) {
  const z = dayNumber + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month = mp < 10 ? mp + 3 : mp - 9
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0)
  return [year, month, day]
}

const toDayNumber = (iso) => {
  const [, y, m, d] = ISO_DATE_PATTERN.exec(iso)
  return dayNumberFromCivil(Number(y), Number(m), Number(d))
}

const toISO = (dayNumber) => {
  const [year, month, day] = civilFromDayNumber(dayNumber)
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const addDays = (iso, days) => toISO(toDayNumber(iso) + days)
/**
 * Whole days from `from` to `to`; positive when `to` is later. Exported so the
 * pattern engine shares this calendar maths instead of carrying its own.
 * @param {ISODate} from
 * @param {ISODate} to
 * @returns {number}
 */
export const daysBetween = (from, to) => toDayNumber(to) - toDayNumber(from)
const round2 = (n) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/** @param {CycleHistoryInput} input */
function assertHistoryInput(input) {
  if (!input || typeof input !== 'object') {
    throw new CycleEngineError('invalid_input', 'input must be an object')
  }
  if (!Array.isArray(input.periodStartDates) || !input.periodStartDates.every(isISODate)) {
    throw new CycleEngineError('invalid_input', 'periodStartDates must be an array of "YYYY-MM-DD" strings')
  }
  for (const key of ['reportedCycleLength', 'reportedPeriodLength']) {
    const value = input[key]
    if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
      throw new CycleEngineError('invalid_input', `${key} must be a positive integer when provided`)
    }
  }
}

/** @param {unknown} asOfDate */
function assertAsOfDate(asOfDate) {
  if (!isISODate(asOfDate)) {
    throw new CycleEngineError('invalid_input', 'asOfDate must be a "YYYY-MM-DD" string')
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (all pure)
// ---------------------------------------------------------------------------

/** Deduplicated, ascending copy of the supplied start dates. */
const sortedStarts = (input) => [...new Set(input.periodStartDates)].sort()

/** Most recent start on or before `asOfDate`, or null. */
function latestStartOnOrBefore(starts, asOfDate) {
  let found = null
  for (const start of starts) {
    if (start <= asOfDate) found = start
    else break
  }
  return found
}

/**
 * Uncertainty parameters for a history, or null when no forecast may be made.
 * @param {CycleStats} stats
 * @returns {{ base: number, growth: number, offset: number } | null}
 */
function uncertaintyFor(stats) {
  if (stats.lengthSource === 'history') {
    const sd = stats.stdDev ?? 0
    return {
      base: Math.max(UNCERTAINTY_MODEL.history.minBase, Math.ceil(sd)),
      growth: Math.max(UNCERTAINTY_MODEL.history.minGrowth, Math.ceil(sd / 2)),
      offset: UNCERTAINTY_MODEL.offsetDays[stats.regularity] ?? 0,
    }
  }
  if (stats.lengthSource === 'reported') {
    return { base: UNCERTAINTY_MODEL.reported.base, growth: UNCERTAINTY_MODEL.reported.growth, offset: 0 }
  }
  return null
}

/**
 * @param {CycleStats} stats
 * @param {number} ordinal
 * @returns {Confidence}
 */
function confidenceFor(stats, ordinal) {
  if (stats.lengthSource !== 'history') return 'low'
  if (stats.regularity === 'irregular') return 'low'
  if (stats.regularity === 'somewhat_irregular') return ordinal === 1 ? 'medium' : 'low'
  if (ordinal === 1) return 'high'
  if (ordinal === 2) return 'medium'
  return 'low'
}

/**
 * @param {CycleStats} stats
 * @param {ISODate} baseStart
 * @param {number} ordinal
 * @param {{ base: number, growth: number, offset: number }} model
 * @returns {PredictedPeriod}
 */
function predictPeriod(stats, baseStart, ordinal, model) {
  const expectedStart = addDays(baseStart, ordinal * stats.typicalLength)
  const uncertaintyDays = model.base + (ordinal - 1) * model.growth + model.offset
  return {
    ordinal,
    expectedStart,
    earliestStart: addDays(expectedStart, -uncertaintyDays),
    latestStart: addDays(expectedStart, uncertaintyDays),
    uncertaintyDays,
    confidence: confidenceFor(stats, ordinal),
  }
}

/**
 * Phase for a 1-based cycle day given the cycle length, period length and how
 * many days past `typicalLength` still count as "waiting" rather than overdue.
 * Exported so the pattern engine places observations with the same band model
 * the Today screen uses; there is exactly one phase model in the codebase.
 * @param {number} cycleDay
 * @param {number} typicalLength
 * @param {number} periodLength
 * @param {number} lateAllowance
 * @returns {Phase}
 */
export function phaseForCycleDay(cycleDay, typicalLength, periodLength, lateAllowance) {
  const ovulationDay = Math.max(periodLength + 2, typicalLength - LUTEAL_PHASE_LENGTH)
  if (cycleDay <= periodLength) return 'menstrual'
  if (cycleDay < ovulationDay - 1) return 'follicular'
  if (cycleDay <= ovulationDay + 1) return 'ovulatory'
  if (cycleDay <= typicalLength + lateAllowance) return 'luteal'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Summarise period history into the statistics every other function builds on.
 *
 * Algorithm:
 *   1. Validate: every start must be a real calendar date ("YYYY-MM-DD"); any
 *      malformed or impossible date (2026-02-30, month 13) → CycleEngineError.
 *   2. Normalise: deduplicate identical dates, sort ascending.
 *   3. Cycle lengths: whole days between consecutive starts. Keep only lengths in
 *      [MIN_PLAUSIBLE_CYCLE_LENGTH, MAX_PLAUSIBLE_CYCLE_LENGTH] (15–60 inclusive);
 *      an out-of-range gap (a missed month of logging, or two starts days apart)
 *      is discarded — it is neither a cycle nor merged with its neighbours.
 *      Then keep the most recent MAX_HISTORY_CYCLES (12).
 *   4. meanLength / stdDev over the kept lengths (population stdDev; null below 2).
 *   5. typicalLength + lengthSource:
 *        ≥ MIN_CYCLES_FOR_HISTORY kept lengths → rounded MEDIAN, 'history'.
 *          Median rather than mean on purpose: one long or short cycle in a
 *          12-cycle window shifts the mean by days but barely moves the median,
 *          so the forecast anchor is robust to exactly the irregularity this
 *          app is meant to surface rather than hide.
 *        else reportedCycleLength provided → that value, 'reported'.
 *        else → DEFAULT_CYCLE_LENGTH, 'default' (callers must not forecast from this).
 *   6. regularity: 'insufficient' below MIN_CYCLES_FOR_HISTORY, otherwise bucketed
 *      by stdDev against REGULARITY_THRESHOLDS (the only regularity model).
 *   7. lastPeriodStart: the latest supplied date, even when no length was kept.
 *
 * Never throws on thin or empty history: `sampleSize` is 0, `regularity` is
 * 'insufficient', and `typicalLength` falls back to the reported length or default.
 *
 * @param {CycleHistoryInput} input
 * @returns {CycleStats}
 */
export function computeCycleStats(input) {
  assertHistoryInput(input)

  const starts = sortedStarts(input)
  const plausible = []
  for (let i = 1; i < starts.length; i += 1) {
    const length = daysBetween(starts[i - 1], starts[i])
    if (length >= MIN_PLAUSIBLE_CYCLE_LENGTH && length <= MAX_PLAUSIBLE_CYCLE_LENGTH) plausible.push(length)
  }
  const cycleLengths = plausible.slice(-MAX_HISTORY_CYCLES)
  const sampleSize = cycleLengths.length

  let meanLength = null
  let stdDev = null
  if (sampleSize > 0) {
    const mean = cycleLengths.reduce((sum, n) => sum + n, 0) / sampleSize
    meanLength = round2(mean)
    if (sampleSize >= 2) {
      const variance = cycleLengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / sampleSize
      stdDev = round2(Math.sqrt(variance))
    }
  }

  let typicalLength
  let lengthSource
  if (sampleSize >= MIN_CYCLES_FOR_HISTORY) {
    const sorted = [...cycleLengths].sort((a, b) => a - b)
    const mid = Math.floor(sampleSize / 2)
    const median = sampleSize % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    typicalLength = Math.round(median)
    lengthSource = 'history'
  } else if (input.reportedCycleLength !== undefined) {
    typicalLength = input.reportedCycleLength
    lengthSource = 'reported'
  } else {
    typicalLength = DEFAULT_CYCLE_LENGTH
    lengthSource = 'default'
  }

  let regularity = 'insufficient'
  if (sampleSize >= MIN_CYCLES_FOR_HISTORY) {
    if (stdDev >= REGULARITY_THRESHOLDS.irregular) regularity = 'irregular'
    else if (stdDev >= REGULARITY_THRESHOLDS.somewhat_irregular) regularity = 'somewhat_irregular'
    else regularity = 'regular'
  }

  return {
    cycleLengths,
    sampleSize,
    typicalLength,
    lengthSource,
    meanLength,
    stdDev,
    regularity,
    lastPeriodStart: starts.length ? starts[starts.length - 1] : null,
  }
}

/**
 * Locate `asOfDate` within the user's current cycle.
 *
 * Postconditions:
 *   - With no start on or before asOfDate: `cycleDay` is null, `phase` is 'unknown', `confidence` is 'low'.
 *   - `cycleDay` is 1 on the most recent period start date and increases by one per day.
 *   - Phase boundaries are derived from `typicalLength` and the period length, so two
 *     users with identical history get identical phases.
 *   - Days past `typicalLength` but inside the next period's window are still 'luteal';
 *     beyond the window `isOverdue` is true and `phase` is 'unknown' — the engine does not
 *     guess why a period is late.
 *   - With `lengthSource === 'default'` there is no prediction, so `isOverdue` is always false
 *     and days past the default length are 'unknown'.
 *
 * @param {CycleHistoryInput} input
 * @param {ISODate} asOfDate
 * @returns {CyclePosition}
 */
export function locateCycleDay(input, asOfDate) {
  assertHistoryInput(input)
  assertAsOfDate(asOfDate)

  const stats = computeCycleStats(input)
  const typicalLength = stats.typicalLength
  const isEstimated = stats.lengthSource !== 'history'
  const base = latestStartOnOrBefore(sortedStarts(input), asOfDate)

  if (!base) {
    return { cycleDay: null, phase: 'unknown', typicalLength, isOverdue: false, isEstimated, confidence: 'low' }
  }

  const cycleDay = daysBetween(base, asOfDate) + 1
  const periodLength = Math.min(input.reportedPeriodLength ?? DEFAULT_PERIOD_LENGTH, Math.floor(typicalLength / 2))

  const model = uncertaintyFor(stats)
  const next = model ? predictPeriod(stats, base, 1, model) : null
  const isOverdue = next ? asOfDate > next.latestStart : false
  // latestStart falls on cycle day typicalLength + uncertainty + 1, so allow exactly that many late days.
  const phase = phaseForCycleDay(cycleDay, typicalLength, periodLength, next ? next.uncertaintyDays + 1 : 0)

  return {
    cycleDay,
    phase,
    typicalLength,
    isOverdue,
    isEstimated,
    confidence: isOverdue ? 'low' : confidenceFor(stats, 1),
  }
}

/**
 * Forecast upcoming period starts within a horizon, each as a window with a confidence.
 *
 * Postconditions:
 *   - `predictedPeriods` is empty — never a default guess — when `basis.lengthSource` is
 *     'default' or no period start exists on or before asOfDate. `caveats` says why.
 *   - Otherwise ordinal 1 is always present; ordinals ≥ 2 only while their window touches
 *     [asOfDate, asOfDate + horizonDays].
 *   - Within a period: earliestStart ≤ expectedStart ≤ latestStart.
 *   - `uncertaintyDays` is non-decreasing with `ordinal`.
 *   - 'irregular' history caps confidence at 'low' and adds a caveat rather than producing
 *     a narrower window.
 *
 * @param {CycleHistoryInput} input
 * @param {{ asOfDate: ISODate, horizonDays?: number }} options
 * @returns {Forecast}
 */
export function forecastCycles(input, options) {
  assertHistoryInput(input)
  if (!options || typeof options !== 'object') {
    throw new CycleEngineError('invalid_input', 'options must be an object')
  }
  assertAsOfDate(options.asOfDate)
  if (options.horizonDays !== undefined && !(Number.isInteger(options.horizonDays) && options.horizonDays > 0)) {
    throw new CycleEngineError('invalid_input', 'horizonDays must be a positive integer when provided')
  }

  const { asOfDate } = options
  const horizonDays = options.horizonDays ?? DEFAULT_FORECAST_HORIZON_DAYS
  const stats = computeCycleStats(input)
  const caveats = []

  const model = uncertaintyFor(stats)
  if (!model) {
    caveats.push(CAVEATS.noBasis)
    return { asOfDate, predictedPeriods: [], basis: stats, windowOffsetUncertaintyDays: 0, caveats }
  }

  const base = latestStartOnOrBefore(sortedStarts(input), asOfDate)
  if (!base) {
    caveats.push(CAVEATS.noStartBeforeDate)
    return { asOfDate, predictedPeriods: [], basis: stats, windowOffsetUncertaintyDays: 0, caveats }
  }

  const horizonEnd = addDays(asOfDate, horizonDays)
  const maxOrdinals = Math.ceil(horizonDays / stats.typicalLength) + 2
  const predictedPeriods = [predictPeriod(stats, base, 1, model)]
  for (let ordinal = 2; ordinal <= maxOrdinals; ordinal += 1) {
    const period = predictPeriod(stats, base, ordinal, model)
    if (period.earliestStart > horizonEnd) break
    predictedPeriods.push(period)
  }

  if (stats.lengthSource === 'reported') caveats.push(CAVEATS.reported)
  if (stats.regularity === 'somewhat_irregular') caveats.push(CAVEATS.somewhatIrregular)
  if (stats.regularity === 'irregular') caveats.push(CAVEATS.irregular)
  const overdueBy = daysBetween(predictedPeriods[0].latestStart, asOfDate)
  if (overdueBy > 0) caveats.push(CAVEATS.overdue(overdueBy))

  return { asOfDate, predictedPeriods, basis: stats, windowOffsetUncertaintyDays: model.offset, caveats }
}
