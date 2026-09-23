import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as cycle from '../src/engines/cycle.js'
import * as shared from '../../shared/constants.ts'

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/** Calls fn twice with deep-frozen input; asserts the same typed outcome both times. */
function assertDeterministic(fn, args, expectedCode) {
  const outcomes = [0, 1].map(() => {
    try {
      return { value: fn(...args) }
    } catch (error) {
      return { name: error.name, code: error.code }
    }
  })
  assert.deepEqual(outcomes[0], outcomes[1])
  assert.equal(outcomes[0].code, expectedCode)
}

/** Build ascending start dates from a first date and a list of cycle lengths. */
function startsFrom(first, lengths) {
  const starts = [first]
  for (const length of lengths) {
    const previous = new Date(`${starts[starts.length - 1]}T00:00:00Z`)
    starts.push(new Date(previous.getTime() + length * 86_400_000).toISOString().slice(0, 10))
  }
  return starts
}

// ---------------------------------------------------------------------------
// Fixtures (all deep-frozen: any mutation by the engine throws a TypeError)
// ---------------------------------------------------------------------------

/** Five 28-day cycles, last start 2026-05-25. */
const regular = deepFreeze({ periodStartDates: startsFrom('2026-01-05', [28, 28, 28, 28, 28]) })

/** stdDev ≈ 6.83 → somewhat_irregular; median 27. Last start 2026-05-29. */
const somewhatIrregular = deepFreeze({ periodStartDates: startsFrom('2026-01-01', [24, 35, 27, 40, 22]) })

/** stdDev ≈ 10.24 → irregular; median 24. Last start 2026-06-01. */
const irregular = deepFreeze({ periodStartDates: startsFrom('2026-01-01', [20, 40, 22, 45, 24]) })

/** One completed cycle + reported length → 'reported'. Last start 2026-04-29. */
const thinReported = deepFreeze({ periodStartDates: ['2026-04-01', '2026-04-29'], reportedCycleLength: 30 })

/** One completed cycle, nothing reported → 'default'. */
const thinNoReport = deepFreeze({ periodStartDates: ['2026-04-01', '2026-04-29'] })

const empty = deepFreeze({ periodStartDates: [] })

// ---------------------------------------------------------------------------
// computeCycleStats
// ---------------------------------------------------------------------------

test('stats: regular history → median length, history source, regular', () => {
  const stats = cycle.computeCycleStats(regular)
  assert.deepEqual(stats, {
    cycleLengths: [28, 28, 28, 28, 28],
    sampleSize: 5,
    typicalLength: 28,
    lengthSource: 'history',
    meanLength: 28,
    stdDev: 0,
    regularity: 'regular',
    lastPeriodStart: '2026-05-25',
  })
})

test('stats: variability buckets by REGULARITY_THRESHOLDS', () => {
  const s1 = cycle.computeCycleStats(somewhatIrregular)
  assert.equal(s1.regularity, 'somewhat_irregular')
  assert.equal(s1.stdDev, 6.83)
  assert.equal(s1.typicalLength, 27)
  assert.deepEqual(s1.cycleLengths, [24, 35, 27, 40, 22])

  const s2 = cycle.computeCycleStats(irregular)
  assert.equal(s2.regularity, 'irregular')
  assert.equal(s2.stdDev, 10.24)
  assert.equal(s2.typicalLength, 24)
})

test('stats: even sample size uses the rounded median', () => {
  const stats = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [27, 29, 28, 30]) })
  assert.equal(stats.sampleSize, 4)
  assert.equal(stats.typicalLength, 29) // median 28.5 → 29
  assert.equal(stats.lengthSource, 'history')
})

test('stats: fewer than MIN_CYCLES_FOR_HISTORY falls back to reported, then default', () => {
  const reported = cycle.computeCycleStats(thinReported)
  assert.equal(reported.sampleSize, 1)
  assert.equal(reported.typicalLength, 30)
  assert.equal(reported.lengthSource, 'reported')
  assert.equal(reported.regularity, 'insufficient')
  assert.equal(reported.meanLength, 28)
  assert.equal(reported.stdDev, null)

  const fallback = cycle.computeCycleStats(thinNoReport)
  assert.equal(fallback.typicalLength, cycle.DEFAULT_CYCLE_LENGTH)
  assert.equal(fallback.lengthSource, 'default')

  const none = cycle.computeCycleStats(empty)
  assert.deepEqual(none, {
    cycleLengths: [],
    sampleSize: 0,
    typicalLength: 28,
    lengthSource: 'default',
    meanLength: null,
    stdDev: null,
    regularity: 'insufficient',
    lastPeriodStart: null,
  })
})

test('stats: reported length is ignored once history is sufficient', () => {
  const stats = cycle.computeCycleStats({ ...regular, reportedCycleLength: 35 })
  assert.equal(stats.typicalLength, 28)
  assert.equal(stats.lengthSource, 'history')
})

test('stats: one unique date (also when duplicated) → no cycles, lastPeriodStart set', () => {
  const expected = {
    cycleLengths: [],
    sampleSize: 0,
    typicalLength: 28,
    lengthSource: 'default',
    meanLength: null,
    stdDev: null,
    regularity: 'insufficient',
    lastPeriodStart: '2026-05-01',
  }
  assert.deepEqual(cycle.computeCycleStats({ periodStartDates: ['2026-05-01'] }), expected)
  assert.deepEqual(cycle.computeCycleStats({ periodStartDates: ['2026-05-01', '2026-05-01', '2026-05-01'] }), expected)
  assert.deepEqual(
    cycle.computeCycleStats({ periodStartDates: ['2026-05-01'], reportedCycleLength: 31 }),
    { ...expected, typicalLength: 31, lengthSource: 'reported' },
  )
})

test('stats: two dates → one cycle length, mean set, stdDev null', () => {
  const stats = cycle.computeCycleStats({ periodStartDates: ['2026-03-01', '2026-03-30'] })
  assert.deepEqual(stats, {
    cycleLengths: [29],
    sampleSize: 1,
    typicalLength: 28,
    lengthSource: 'default',
    meanLength: 29,
    stdDev: null,
    regularity: 'insufficient',
    lastPeriodStart: '2026-03-30',
  })
})

test('stats: exactly MIN_CYCLES_FOR_HISTORY valid lengths switches to history', () => {
  const two = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [30, 32]), reportedCycleLength: 25 })
  assert.equal(two.sampleSize, 2)
  assert.equal(two.lengthSource, 'reported')
  assert.equal(two.typicalLength, 25)
  assert.equal(two.regularity, 'insufficient')
  assert.equal(two.stdDev, 1)

  const three = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [30, 32, 31]), reportedCycleLength: 25 })
  assert.equal(three.sampleSize, cycle.MIN_CYCLES_FOR_HISTORY)
  assert.equal(three.lengthSource, 'history')
  assert.equal(three.typicalLength, 31) // median of 30, 31, 32
  assert.equal(three.meanLength, 31)
  assert.equal(three.stdDev, 0.82)
  assert.equal(three.regularity, 'regular')
})

test('stats: plausible range is 15–60 inclusive', () => {
  const keep = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [15, 60, 15]) })
  assert.deepEqual(keep.cycleLengths, [15, 60, 15])
  const drop = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [14, 61, 14]) })
  assert.deepEqual(drop.cycleLengths, [])
  assert.equal(cycle.MIN_PLAUSIBLE_CYCLE_LENGTH, 15)
  assert.equal(cycle.MAX_PLAUSIBLE_CYCLE_LENGTH, 60)
})

test('stats: out-of-range intervals are discarded without corrupting the statistics', () => {
  const clean = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [28, 28, 28]) })
  // A missed-logging gap (92) and two starts only 10 days apart, interleaved with real cycles.
  const noisy = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [28, 92, 28, 10, 28]) })
  const { lastPeriodStart: _c, ...cleanRest } = clean
  const { lastPeriodStart: _n, ...noisyRest } = noisy
  assert.deepEqual(noisyRest, cleanRest)
  assert.deepEqual(noisy.cycleLengths, [28, 28, 28])
  assert.equal(noisy.meanLength, 28)
  assert.equal(noisy.stdDev, 0)
  assert.equal(noisy.regularity, 'regular')
})

test('stats: all intervals invalid → no cycles, but lastPeriodStart is still known', () => {
  const stats = cycle.computeCycleStats({ periodStartDates: startsFrom('2026-01-01', [10, 10, 10, 90]), reportedCycleLength: 29 })
  assert.deepEqual(stats.cycleLengths, [])
  assert.equal(stats.sampleSize, 0)
  assert.equal(stats.lengthSource, 'reported')
  assert.equal(stats.typicalLength, 29)
  assert.equal(stats.regularity, 'insufficient')
  assert.equal(stats.meanLength, null)
  assert.equal(stats.lastPeriodStart, '2026-05-01') // 01-01 → 01-11 → 01-21 → 01-31 → +90 → 05-01
})

test('stats: only the most recent MAX_HISTORY_CYCLES lengths are kept', () => {
  // 15 cycles: the three oldest (40, 40, 40) must fall outside the 12-cycle window.
  const lengths = [40, 40, 40, ...Array(12).fill(28)]
  const stats = cycle.computeCycleStats({ periodStartDates: startsFrom('2024-01-01', lengths) })
  assert.equal(stats.sampleSize, cycle.MAX_HISTORY_CYCLES)
  assert.deepEqual(stats.cycleLengths, Array(12).fill(28))
  assert.equal(stats.stdDev, 0)
  assert.equal(stats.regularity, 'regular')
})

test('stats: unordered and duplicated inputs give identical output', () => {
  const shuffled = deepFreeze({
    periodStartDates: [...regular.periodStartDates].reverse().concat(regular.periodStartDates[2]),
  })
  assert.deepEqual(cycle.computeCycleStats(shuffled), cycle.computeCycleStats(regular))
})

test('stats: input is not mutated and repeated calls are identical', () => {
  const input = { periodStartDates: ['2026-05-25', '2026-01-05', '2026-03-02', '2026-03-02', '2026-02-02'], reportedCycleLength: 30 }
  const before = JSON.stringify(input)
  const first = cycle.computeCycleStats(input)
  const second = cycle.computeCycleStats(input)
  assert.equal(JSON.stringify(input), before, 'input untouched (order and duplicates preserved)')
  assert.deepEqual(first, second)
  assert.notEqual(first, second, 'fresh object each call')
  assert.notEqual(first.cycleLengths, second.cycleLengths, 'fresh arrays each call')
})

test('stats: engine constants are pinned to shared/constants.ts (no competing values)', () => {
  assert.equal(cycle.MIN_PLAUSIBLE_CYCLE_LENGTH, shared.CYCLE_LENGTH_RANGE.min)
  assert.equal(cycle.MAX_PLAUSIBLE_CYCLE_LENGTH, shared.CYCLE_LENGTH_RANGE.max)
  assert.equal(cycle.DEFAULT_CYCLE_LENGTH, shared.DEFAULT_CYCLE_LENGTH)
  assert.equal(cycle.DEFAULT_PERIOD_LENGTH, shared.DEFAULT_PERIOD_LENGTH)
  const stats = [regular, somewhatIrregular, irregular, thinReported, empty].map(cycle.computeCycleStats)
  for (const s of stats) {
    assert.ok(shared.LENGTH_SOURCES.includes(s.lengthSource), s.lengthSource)
    assert.ok(shared.REGULARITIES.includes(s.regularity), s.regularity)
  }
})

test('stats: malformed and impossible dates are rejected', () => {
  for (const bad of ['2026-13-01', '2026-04-31', '2027-02-29', '2026-00-10', '2026-02-30', '26-02-01', '2026/02/01', '2026-2-1']) {
    assertDeterministic(cycle.computeCycleStats, [{ periodStartDates: ['2026-01-01', bad] }], 'invalid_input')
  }
  assert.equal(cycle.computeCycleStats({ periodStartDates: ['2028-02-29'] }).lastPeriodStart, '2028-02-29', 'leap day accepted')
})

test('calendar maths matches Date for every day in DATE_BOUNDS', () => {
  const start = Date.UTC(2000, 0, 1)
  const end = Date.UTC(2100, 11, 31)
  let count = 0
  for (let ms = start; ms <= end; ms += 86_400_000) {
    const iso = new Date(ms).toISOString().slice(0, 10)
    assert.equal(cycle.isISODate(iso), true, iso)
    count += 1
  }
  assert.equal(count, 36890)
  // addDays / daysBetween (via forecast and position) across month, year and leap boundaries.
  for (const [base, length, expected] of [
    ['2026-12-20', 28, '2027-01-17'],
    ['2028-02-01', 29, '2028-03-01'],
    ['2027-02-01', 29, '2027-03-02'],
    ['2100-01-31', 30, '2100-03-02'], // 2100 is not a leap year
    ['2000-02-28', 15, '2000-03-14'], // 2000 is a leap year
  ]) {
    const forecast = cycle.forecastCycles({ periodStartDates: [base], reportedCycleLength: length }, { asOfDate: base })
    assert.equal(forecast.predictedPeriods[0].expectedStart, expected)
    assert.equal(cycle.locateCycleDay({ periodStartDates: [base] }, expected).cycleDay, length + 1)
  }
})

// ---------------------------------------------------------------------------
// locateCycleDay
// ---------------------------------------------------------------------------

test('position: cycle day and phases for a regular history', () => {
  const at = (date) => cycle.locateCycleDay(regular, date)

  assert.deepEqual(at('2026-05-25'), {
    cycleDay: 1, phase: 'menstrual', typicalLength: 28, isOverdue: false, isEstimated: false, confidence: 'high',
  })
  assert.equal(at('2026-05-29').phase, 'menstrual') // day 5 = DEFAULT_PERIOD_LENGTH
  assert.equal(at('2026-05-30').phase, 'follicular') // day 6
  assert.equal(at('2026-06-05').phase, 'follicular') // day 12
  assert.equal(at('2026-06-06').phase, 'ovulatory') // day 13 (ovulation day 14 ± 1)
  assert.equal(at('2026-06-08').phase, 'ovulatory') // day 15
  assert.equal(at('2026-06-09').phase, 'luteal') // day 16
  assert.equal(at('2026-06-21').phase, 'luteal') // day 28
})

test('position: late days inside the predicted window are luteal; past it the period is overdue and phase is unknown', () => {
  // Next period expected 2026-06-22 ± 1 day → latest 2026-06-23.
  const waiting = cycle.locateCycleDay(regular, '2026-06-23')
  assert.equal(waiting.cycleDay, 30)
  assert.equal(waiting.phase, 'luteal')
  assert.equal(waiting.isOverdue, false)

  const overdue = cycle.locateCycleDay(regular, '2026-06-24')
  assert.deepEqual(overdue, {
    cycleDay: 31, phase: 'unknown', typicalLength: 28, isOverdue: true, isEstimated: false, confidence: 'low',
  })
})

test('position: reported period length moves the menstrual boundary', () => {
  const input = { ...regular, reportedPeriodLength: 3 }
  assert.equal(cycle.locateCycleDay(input, '2026-05-27').phase, 'menstrual') // day 3
  assert.equal(cycle.locateCycleDay(input, '2026-05-28').phase, 'follicular') // day 4
})

test('position: no history, or no start on or before the date → null day, unknown phase', () => {
  const none = cycle.locateCycleDay(empty, '2026-06-01')
  assert.deepEqual(none, {
    cycleDay: null, phase: 'unknown', typicalLength: 28, isOverdue: false, isEstimated: true, confidence: 'low',
  })
  const beforeAll = cycle.locateCycleDay(regular, '2025-12-01')
  assert.equal(beforeAll.cycleDay, null)
  assert.equal(beforeAll.phase, 'unknown')
})

test('position: default length source still locates the day but never reports overdue', () => {
  const inCycle = cycle.locateCycleDay(thinNoReport, '2026-05-05')
  assert.deepEqual(inCycle, {
    cycleDay: 7, phase: 'follicular', typicalLength: 28, isOverdue: false, isEstimated: true, confidence: 'low',
  })
  const pastDefault = cycle.locateCycleDay(thinNoReport, '2026-05-27') // day 29 with no prediction
  assert.equal(pastDefault.phase, 'unknown')
  assert.equal(pastDefault.isOverdue, false)
})

test('position: confidence follows regularity', () => {
  assert.equal(cycle.locateCycleDay(somewhatIrregular, '2026-06-01').confidence, 'medium')
  assert.equal(cycle.locateCycleDay(irregular, '2026-06-05').confidence, 'low')
  assert.equal(cycle.locateCycleDay(thinReported, '2026-05-05').confidence, 'low')
  assert.equal(cycle.locateCycleDay(thinReported, '2026-05-05').isEstimated, true)
})

// ---------------------------------------------------------------------------
// forecastCycles
// ---------------------------------------------------------------------------

function assertWellFormed(forecast) {
  let previousUncertainty = -1
  forecast.predictedPeriods.forEach((period, index) => {
    assert.equal(period.ordinal, index + 1, 'ordered by ordinal')
    assert.ok(period.earliestStart <= period.expectedStart && period.expectedStart <= period.latestStart, 'window ordered')
    assert.ok(period.uncertaintyDays >= previousUncertainty, 'uncertainty non-decreasing')
    previousUncertainty = period.uncertaintyDays
  })
}

test('forecast: regular history → tight windows, confidence decays with ordinal, horizon respected', () => {
  const forecast = cycle.forecastCycles(regular, { asOfDate: '2026-06-01', horizonDays: 90 })
  assertWellFormed(forecast)
  assert.deepEqual(forecast.predictedPeriods, [
    { ordinal: 1, expectedStart: '2026-06-22', earliestStart: '2026-06-21', latestStart: '2026-06-23', uncertaintyDays: 1, confidence: 'high' },
    { ordinal: 2, expectedStart: '2026-07-20', earliestStart: '2026-07-18', latestStart: '2026-07-22', uncertaintyDays: 2, confidence: 'medium' },
    { ordinal: 3, expectedStart: '2026-08-17', earliestStart: '2026-08-14', latestStart: '2026-08-20', uncertaintyDays: 3, confidence: 'low' },
  ])
  assert.equal(forecast.windowOffsetUncertaintyDays, 0)
  assert.deepEqual(forecast.caveats, [])
  assert.deepEqual(forecast.basis, cycle.computeCycleStats(regular))
  assert.equal(forecast.asOfDate, '2026-06-01')
})

test('forecast: default horizon is DEFAULT_FORECAST_HORIZON_DAYS', () => {
  const explicit = cycle.forecastCycles(regular, { asOfDate: '2026-06-01', horizonDays: cycle.DEFAULT_FORECAST_HORIZON_DAYS })
  const implicit = cycle.forecastCycles(regular, { asOfDate: '2026-06-01' })
  assert.deepEqual(implicit, explicit)
})

test('forecast: no fabricated prediction when the length would be the default', () => {
  for (const input of [empty, thinNoReport]) {
    const forecast = cycle.forecastCycles(input, { asOfDate: '2026-06-01' })
    assert.equal(forecast.basis.lengthSource, 'default')
    assert.deepEqual(forecast.predictedPeriods, [])
    assert.deepEqual(forecast.caveats, [cycle.CAVEATS.noBasis])
    assert.equal(forecast.windowOffsetUncertaintyDays, 0)
  }
})

test('forecast: reported length → user-reported basis, low confidence, caveat', () => {
  const forecast = cycle.forecastCycles(thinReported, { asOfDate: '2026-05-10', horizonDays: 60 })
  assertWellFormed(forecast)
  assert.equal(forecast.basis.lengthSource, 'reported')
  assert.deepEqual(forecast.predictedPeriods, [
    { ordinal: 1, expectedStart: '2026-05-29', earliestStart: '2026-05-26', latestStart: '2026-06-01', uncertaintyDays: 3, confidence: 'low' },
    { ordinal: 2, expectedStart: '2026-06-28', earliestStart: '2026-06-23', latestStart: '2026-07-03', uncertaintyDays: 5, confidence: 'low' },
  ])
  assert.deepEqual(forecast.caveats, [cycle.CAVEATS.reported])
})

test('forecast: irregular history widens the window, caps confidence at low, keeps the offset separate', () => {
  const forecast = cycle.forecastCycles(irregular, { asOfDate: '2026-06-05', horizonDays: 60 })
  assertWellFormed(forecast)
  const [next] = forecast.predictedPeriods
  assert.equal(next.expectedStart, '2026-06-25') // 2026-06-01 + 24
  assert.equal(next.uncertaintyDays, 14) // ceil(10.24) + offset 3
  assert.equal(forecast.windowOffsetUncertaintyDays, cycle.UNCERTAINTY_MODEL.offsetDays.irregular)
  assert.equal(next.uncertaintyDays - forecast.windowOffsetUncertaintyDays, 11, 'period-date uncertainty recoverable')
  assert.ok(forecast.predictedPeriods.every((p) => p.confidence === 'low'))
  assert.deepEqual(forecast.caveats, [cycle.CAVEATS.irregular])

  const mild = cycle.forecastCycles(somewhatIrregular, { asOfDate: '2026-06-01', horizonDays: 60 })
  assert.equal(mild.predictedPeriods[0].confidence, 'medium')
  assert.equal(mild.predictedPeriods[0].uncertaintyDays, 8) // ceil(6.83) + offset 1
  assert.equal(mild.windowOffsetUncertaintyDays, 1)
  assert.deepEqual(mild.caveats, [cycle.CAVEATS.somewhatIrregular])

  const tight = cycle.forecastCycles(regular, { asOfDate: '2026-06-01', horizonDays: 60 })
  assert.ok(next.uncertaintyDays > tight.predictedPeriods[0].uncertaintyDays)
})

test('forecast: an overdue period keeps ordinal 1 and explains it', () => {
  const forecast = cycle.forecastCycles(regular, { asOfDate: '2026-06-30', horizonDays: 90 })
  assert.equal(forecast.predictedPeriods[0].ordinal, 1)
  assert.equal(forecast.predictedPeriods[0].expectedStart, '2026-06-22')
  assert.deepEqual(forecast.caveats, [cycle.CAVEATS.overdue(7)]) // latest 2026-06-23 → 2026-06-30
})

test('forecast: history only after the date → nothing to forecast from', () => {
  const forecast = cycle.forecastCycles(thinReported, { asOfDate: '2026-03-01' })
  assert.deepEqual(forecast.predictedPeriods, [])
  assert.deepEqual(forecast.caveats, [cycle.CAVEATS.noStartBeforeDate])
})

// ---------------------------------------------------------------------------
// Determinism, purity, validation
// ---------------------------------------------------------------------------

test('cycle engine: identical input → byte-identical output, input untouched', () => {
  const options = deepFreeze({ asOfDate: '2026-06-01', horizonDays: 90 })
  for (const input of [regular, somewhatIrregular, irregular, thinReported, thinNoReport, empty]) {
    const a = JSON.stringify(cycle.forecastCycles(input, options))
    const b = JSON.stringify(cycle.forecastCycles(input, options))
    assert.equal(a, b)
    assert.equal(JSON.stringify(cycle.locateCycleDay(input, '2026-06-01')), JSON.stringify(cycle.locateCycleDay(input, '2026-06-01')))
  }
  assert.equal(typeof cycle.MODEL_VERSION, 'string')
  assert.match(cycle.MODEL_VERSION, /^[a-z0-9][a-z0-9._-]{0,39}$/, 'matches forecasts.model_version CHECK')
})

test('cycle engine: rejects invalid input with a typed error', () => {
  assertDeterministic(cycle.computeCycleStats, [{ periodStartDates: ['2026-02-30'] }], 'invalid_input')
  assertDeterministic(cycle.computeCycleStats, [{ periodStartDates: ['2026-08-14'], reportedCycleLength: 0 }], 'invalid_input')
  assertDeterministic(cycle.forecastCycles, [regular, { asOfDate: 'today' }], 'invalid_input')
  assertDeterministic(cycle.forecastCycles, [regular, { asOfDate: '2026-06-01', horizonDays: 0 }], 'invalid_input')
  assertDeterministic(cycle.locateCycleDay, [regular, undefined], 'invalid_input')
})

test('cycle engine: isISODate accepts only real calendar dates', () => {
  assert.equal(cycle.isISODate('2026-08-14'), true)
  assert.equal(cycle.isISODate('2026-02-30'), false)
  assert.equal(cycle.isISODate('2026-8-14'), false)
  assert.equal(cycle.isISODate(new Date()), false)
})

// ---------------------------------------------------------------------------
// Purity at the source level (both engines)
// ---------------------------------------------------------------------------

test('engines have no I/O, clock, or randomness at the source level', async () => {
  for (const file of ['cycle.js', 'patternConfidence.js']) {
    const raw = await readFile(new URL(`../src/engines/${file}`, import.meta.url), 'utf8')
    // Check code only — the JSDoc headers legitimately name the things they forbid.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of ['Date.now(', 'new Date(', 'Date.parse', 'Math.random', 'supabase', 'process.env', 'fetch(', "from '../lib", "from '../config"]) {
      assert.ok(!source.includes(forbidden), `${file} contains "${forbidden}"`)
    }
  }
  const causal = /\b(cause|causes|caused|because|due to|diagnos|pregnan|fertil)\w*/i
  for (const text of Object.values(cycle.CAVEATS)) {
    const sentence = typeof text === 'function' ? text(3) : text
    assert.ok(!causal.test(sentence), `medical/causal language in caveat: ${sentence}`)
  }
})
