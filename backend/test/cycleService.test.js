import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCycleService, BASIS_FOR_LENGTH_SOURCE, SNAPSHOT_COMPARE_KEYS } from '../src/services/cycleService.js'
import * as cycle from '../src/engines/cycle.js'
import * as shared from '../../shared/constants.ts'

const TS = '2026-09-13T14:00:00+00:00'
const DB = { scoped: true }

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const startsFrom = (first, lengths) => lengths.reduce((acc, len) => [...acc, addDays(acc[acc.length - 1], len)], [first])

const settingsOf = (over = {}) => ({ id: 'cs-1', reportedCycleLength: null, reportedPeriodLength: null, lastPeriodStart: null, createdAt: TS, updatedAt: TS, ...over })
const eventOf = (date, type = 'period_start') => ({ id: `e-${date}`, type, date, createdAt: TS })
const obsOf = (date, over = {}) => ({ id: `o-${date}`, date, mood: 3, energy: null, symptoms: [], note: null, createdAt: TS, updatedAt: TS, ...over })
const snapOf = (over = {}) => ({
  id: 'f-1', windowStart: '2026-06-21', windowEnd: '2026-06-23', expectedPeriodDate: '2026-06-22',
  periodUncertaintyDays: 1, windowOffsetUncertaintyDays: 0, basis: 'observed_cycle', generatedAt: TS, modelVersion: cycle.MODEL_VERSION, ...over,
})

/** Five 28-day cycles, last start 2026-05-25 → next expected 2026-06-22 ± 1. */
const REGULAR = startsFrom('2026-01-05', [28, 28, 28, 28, 28])
const IRREGULAR = startsFrom('2026-01-01', [20, 40, 22, 45, 24]) // last start 2026-06-01, median 24, sd ≈ 10.24

/** Fake repos: settings/events/observations answer from fixtures; forecasts records latest/insert. */
function fakes({ settings = null, events = [], observations = [], latest = null, modelVersion } = {}) {
  const calls = []
  const repos = {
    cycleSettings: { get: async (db) => (calls.push(['settings.get', db]), settings) },
    cycleEvents: { list: async (db, range) => (calls.push(['events.list', db, range]), events) },
    observations: { list: async (db, range) => (calls.push(['observations.list', db, range]), observations) },
    forecasts: {
      latest: async (db) => (calls.push(['forecasts.latest', db]), latest),
      insert: async (db, snapshot) => (calls.push(['forecasts.insert', db, snapshot]), { id: 'f-new', generatedAt: TS, ...snapshot }),
    },
  }
  return { calls, service: createCycleService({ ...repos, modelVersion }), names: () => calls.map(([n]) => n) }
}

const CAUSAL = /\b(cause|causes|caused|because|due to|leads? to|triggers?|results? in|diagnos|pregnan|fertil)\w*/i
const TODAY_KEYS = ['caveats', 'date', 'forecastBasis', 'hasCycleSettings', 'loggedDays', 'nextPeriod', 'position', 'todayObservation']

function assertSnapshotShape(snapshot) {
  assert.deepEqual(Object.keys(snapshot).sort(), TODAY_KEYS)
  assert.deepEqual(Object.keys(snapshot.position).sort(), ['confidence', 'cycleDay', 'isEstimated', 'isOverdue', 'phase', 'typicalLength'])
  if (snapshot.nextPeriod) {
    assert.deepEqual(Object.keys(snapshot.nextPeriod).sort(), ['confidence', 'earliestStart', 'expectedStart', 'latestStart', 'ordinal', 'uncertaintyDays'])
    assert.ok(!('windowOffsetUncertaintyDays' in snapshot.nextPeriod), 'engine-only field never reaches the wire')
  }
  assert.deepEqual(Object.keys(snapshot.loggedDays).sort(), ['last30', 'total'])
  for (const caveat of snapshot.caveats) assert.ok(!CAUSAL.test(caveat), caveat)
  const text = JSON.stringify(snapshot)
  assert.ok(!text.includes('user_id') && !text.includes('userId') && !text.includes('"id":"u'), 'no identity anywhere')
}

// ---------------------------------------------------------------------------
// No-forecast states — the forecasts table is never touched
// ---------------------------------------------------------------------------

test('no cycle settings and no history → onboarding state, no forecast, no forecast queries', async () => {
  const f = fakes()
  const today = await f.service.getToday(DB, '2026-06-01')
  assertSnapshotShape(today)
  assert.deepEqual(today, {
    date: '2026-06-01',
    hasCycleSettings: false,
    position: { cycleDay: null, phase: 'unknown', typicalLength: 28, isOverdue: false, isEstimated: true, confidence: 'low' },
    nextPeriod: null,
    forecastBasis: null,
    caveats: [cycle.CAVEATS.noBasis],
    loggedDays: { total: 0, last30: 0 },
    todayObservation: null,
  })
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list'])
  assert.deepEqual(f.calls[1][2], { type: 'period_start', to: '2026-06-01' }, 'events bounded to asOfDate at the query')
})

test('settings exist but no period_start → hasCycleSettings true, no-start caveat, no forecast', async () => {
  const f = fakes({ settings: settingsOf({ reportedCycleLength: 28 }) })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.hasCycleSettings, true)
  assert.equal(today.nextPeriod, null)
  assert.equal(today.forecastBasis, null)
  assert.deepEqual(today.caveats, [cycle.CAVEATS.noStartBeforeDate])
  assert.equal(today.position.cycleDay, null)
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list'])
})

test('only future period_start events → treated as no history for asOfDate', async () => {
  // The fake ignores the `to` bound on purpose, so the service filter must do the work.
  const f = fakes({ settings: settingsOf({ reportedCycleLength: 28 }), events: [eventOf('2026-06-10'), eventOf('2026-07-08')] })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.nextPeriod, null)
  assert.equal(today.position.cycleDay, null)
  assert.deepEqual(today.caveats, [cycle.CAVEATS.noStartBeforeDate])
  assert.ok(!f.names().includes('forecasts.latest'))
})

test('history without reported length below 3 cycles → default source, phase positioned, NO forecast', async () => {
  const f = fakes({ settings: settingsOf(), events: [eventOf('2026-04-01'), eventOf('2026-04-29')] })
  const today = await f.service.getToday(DB, '2026-05-05')
  assert.equal(today.hasCycleSettings, true)
  assert.deepEqual(today.position, { cycleDay: 7, phase: 'follicular', typicalLength: 28, isOverdue: false, isEstimated: true, confidence: 'low' })
  assert.equal(today.nextPeriod, null, 'the 28-day fallback is never a forecast')
  assert.equal(today.forecastBasis, null)
  assert.deepEqual(today.caveats, [cycle.CAVEATS.noBasis])
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list'])
})

test('past and future events mixed: only starts on/before asOfDate feed the engine; period_end is ignored', async () => {
  const events = [...REGULAR.map((d) => eventOf(d)), eventOf('2026-05-29', 'period_end'), eventOf('2026-06-22')]
  const f = fakes({ events })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.position.cycleDay, 8, 'current cycle anchored on 2026-05-25, not the future 06-22 start')
  assert.equal(today.nextPeriod.expectedStart, '2026-06-22')
})

// ---------------------------------------------------------------------------
// Forecast states — mapping, persistence, freshness
// ---------------------------------------------------------------------------

test('ForecastBasis mapping is exactly the frozen table', () => {
  assert.deepEqual(BASIS_FOR_LENGTH_SOURCE, { reported: 'user_reported', history: 'observed_cycle', default: null })
  for (const basis of Object.values(BASIS_FOR_LENGTH_SOURCE)) if (basis !== null) assert.ok(shared.FORECAST_BASES.includes(basis))
  assert.ok(!Object.values(BASIS_FOR_LENGTH_SOURCE).includes('calibrated'), 'calibrated is reserved')
  assert.deepEqual([...SNAPSHOT_COMPARE_KEYS], ['windowStart', 'windowEnd', 'expectedPeriodDate', 'periodUncertaintyDays', 'windowOffsetUncertaintyDays', 'basis', 'modelVersion'])
})

test('reported length + thin history → broad low-confidence forecast, basis user_reported, snapshot persisted', async () => {
  const f = fakes({ settings: settingsOf({ reportedCycleLength: 30 }), events: [eventOf('2026-05-01')] })
  const today = await f.service.getToday(DB, '2026-05-10')
  assertSnapshotShape(today)
  assert.equal(today.forecastBasis, 'user_reported')
  assert.deepEqual(today.nextPeriod, { ordinal: 1, expectedStart: '2026-05-31', earliestStart: '2026-05-28', latestStart: '2026-06-03', uncertaintyDays: 3, confidence: 'low' })
  assert.deepEqual(today.caveats, [cycle.CAVEATS.reported])
  assert.equal(today.position.isEstimated, true)
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'forecasts.latest', 'forecasts.insert'])
  assert.deepEqual(f.calls[4][2], {
    windowStart: '2026-05-28', windowEnd: '2026-06-03', expectedPeriodDate: '2026-05-31',
    periodUncertaintyDays: 3, windowOffsetUncertaintyDays: 0, basis: 'user_reported', modelVersion: cycle.MODEL_VERSION,
  })
})

test('≥3 historical cycles → basis observed_cycle, history beats reported, snapshot persisted', async () => {
  const f = fakes({ settings: settingsOf({ reportedCycleLength: 35 }), events: REGULAR.map((d) => eventOf(d)) })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.forecastBasis, 'observed_cycle')
  assert.deepEqual(today.nextPeriod, { ordinal: 1, expectedStart: '2026-06-22', earliestStart: '2026-06-21', latestStart: '2026-06-23', uncertaintyDays: 1, confidence: 'high' })
  assert.equal(today.position.typicalLength, 28, 'reported 35 ignored once history is sufficient')
  assert.equal(today.position.isEstimated, false)
  assert.deepEqual(today.caveats, [])
  assert.deepEqual(f.calls[4][2], {
    windowStart: '2026-06-21', windowEnd: '2026-06-23', expectedPeriodDate: '2026-06-22',
    periodUncertaintyDays: 1, windowOffsetUncertaintyDays: 0, basis: 'observed_cycle', modelVersion: 'cycle-1',
  })
})

test('history without any settings row still forecasts (hasCycleSettings false)', async () => {
  const f = fakes({ settings: null, events: REGULAR.map((d) => eventOf(d)) })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.hasCycleSettings, false)
  assert.equal(today.forecastBasis, 'observed_cycle')
  assert.ok(today.nextPeriod)
})

test('irregular history → wide window, low confidence, caveat, offset persisted separately from the half-width', async () => {
  const f = fakes({ events: IRREGULAR.map((d) => eventOf(d)) })
  const today = await f.service.getToday(DB, '2026-06-05')
  assert.equal(today.forecastBasis, 'observed_cycle')
  assert.equal(today.nextPeriod.confidence, 'low')
  assert.equal(today.nextPeriod.uncertaintyDays, 14)
  assert.deepEqual(today.caveats, [cycle.CAVEATS.irregular])
  const inserted = f.calls.find(([n]) => n === 'forecasts.insert')[2]
  assert.equal(inserted.periodUncertaintyDays, 14)
  assert.equal(inserted.windowOffsetUncertaintyDays, 3)
  assert.equal(inserted.basis, 'observed_cycle')
})

test('latest snapshot identical → no insert', async () => {
  const f = fakes({ events: REGULAR.map((d) => eventOf(d)), latest: snapOf() })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.ok(today.nextPeriod)
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'forecasts.latest'])
})

test('changed snapshot (new period logged) → insert; the old row is never touched', async () => {
  // Stored snapshot predicted 06-22; a new start on 06-20 moves the prediction.
  const f = fakes({ events: [...REGULAR, '2026-06-20'].map((d) => eventOf(d)), latest: snapOf() })
  const today = await f.service.getToday(DB, '2026-06-25')
  assert.equal(today.nextPeriod.expectedStart, '2026-07-18')
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'forecasts.latest', 'forecasts.insert'])
  assert.equal(f.calls[4][2].expectedPeriodDate, '2026-07-18')
  assert.ok(!f.names().some((n) => /update|delete/.test(n)))
})

test('model version changed → insert even when every window value matches', async () => {
  const f = fakes({ events: REGULAR.map((d) => eventOf(d)), latest: snapOf({ modelVersion: 'cycle-1' }), modelVersion: 'cycle-2' })
  await f.service.getToday(DB, '2026-06-01')
  assert.ok(f.names().includes('forecasts.insert'))
  assert.equal(f.calls[4][2].modelVersion, 'cycle-2')
})

test('each of the seven compared values triggers an insert when different', async () => {
  for (const key of SNAPSHOT_COMPARE_KEYS) {
    const stale = snapOf({ [key]: key === 'basis' ? 'user_reported' : key === 'modelVersion' ? 'cycle-0' : key.endsWith('Days') ? 9 : '2026-01-01' })
    const f = fakes({ events: REGULAR.map((d) => eventOf(d)), latest: stale })
    await f.service.getToday(DB, '2026-06-01')
    assert.ok(f.names().includes('forecasts.insert'), `${key} difference must insert`)
  }
})

test('nextPeriod is the fresh engine result even when a stale snapshot exists', async () => {
  const stale = snapOf({ expectedPeriodDate: '2026-12-25', windowStart: '2026-12-24', windowEnd: '2026-12-26' })
  const f = fakes({ events: REGULAR.map((d) => eventOf(d)), latest: stale })
  const today = await f.service.getToday(DB, '2026-06-01')
  assert.equal(today.nextPeriod.expectedStart, '2026-06-22', 'not 2026-12-25 from the database')
  assert.equal(f.calls[4][2].expectedPeriodDate, '2026-06-22')
})

// ---------------------------------------------------------------------------
// Overdue
// ---------------------------------------------------------------------------

test('overdue: nextPeriod stays visible, isOverdue derived from asOfDate > latestStart, phase unknown, caveat', async () => {
  const f = fakes({ events: REGULAR.map((d) => eventOf(d)) })
  const waiting = await f.service.getToday(DB, '2026-06-23') // latestStart
  assert.equal(waiting.position.isOverdue, false)
  assert.equal(waiting.position.phase, 'luteal')

  const overdue = await f.service.getToday(DB, '2026-06-30')
  assert.deepEqual(overdue.nextPeriod, { ordinal: 1, expectedStart: '2026-06-22', earliestStart: '2026-06-21', latestStart: '2026-06-23', uncertaintyDays: 1, confidence: 'high' })
  assert.equal(overdue.position.isOverdue, true)
  assert.equal(overdue.position.phase, 'unknown')
  assert.equal(overdue.position.confidence, 'low')
  assert.deepEqual(overdue.caveats, [cycle.CAVEATS.overdue(7)])
  assert.equal(overdue.forecastBasis, 'observed_cycle')
  assert.ok(!JSON.stringify(overdue).includes('superseded') && !JSON.stringify(overdue).includes('active'), 'no status vocabulary on the wire')
})

// ---------------------------------------------------------------------------
// Logged days / today's observation
// ---------------------------------------------------------------------------

test('loggedDays: total is all-time, last30 is the 30 days ending on asOfDate inclusive; todayObservation present/absent', async () => {
  const asOf = '2026-06-01'
  const observations = [
    obsOf(addDays(asOf, -100)), // total only
    obsOf(addDays(asOf, -30)), // just outside the window
    obsOf(addDays(asOf, -29)), // first day inside
    obsOf(addDays(asOf, -1)),
    obsOf(asOf, { mood: 4, symptoms: ['cramps'] }), // today
  ]
  const f = fakes({ observations })
  const today = await f.service.getToday(DB, asOf)
  assert.deepEqual(today.loggedDays, { total: 5, last30: 3 })
  assert.deepEqual(today.todayObservation, obsOf(asOf, { mood: 4, symptoms: ['cramps'] }))
  assert.deepEqual(f.calls.find(([n]) => n === 'observations.list')[2], undefined, 'one unbounded list call')

  const absent = await fakes({ observations: [obsOf(addDays(asOf, -1))] }).service.getToday(DB, asOf)
  assert.deepEqual(absent.loggedDays, { total: 1, last30: 1 })
  assert.equal(absent.todayObservation, null)

  // Observations after asOfDate (a past-date snapshot) count toward total but never toward last30/today.
  const later = await fakes({ observations: [obsOf(addDays(asOf, 3))] }).service.getToday(DB, asOf)
  assert.deepEqual(later.loggedDays, { total: 1, last30: 0 })
  assert.equal(later.todayObservation, null)
})

// ---------------------------------------------------------------------------
// Determinism, errors, purity
// ---------------------------------------------------------------------------

test('deterministic: identical rows + asOfDate → identical snapshot; repository errors propagate', async () => {
  const a = await fakes({ settings: settingsOf({ reportedCycleLength: 30 }), events: REGULAR.map((d) => eventOf(d)), observations: [obsOf('2026-06-01')] }).service.getToday(DB, '2026-06-01')
  const b = await fakes({ settings: settingsOf({ reportedCycleLength: 30 }), events: REGULAR.map((d) => eventOf(d)), observations: [obsOf('2026-06-01')] }).service.getToday(DB, '2026-06-01')
  assert.deepEqual(a, b)

  const pgError = { code: '42501', message: 'rls' }
  const f = fakes({ events: REGULAR.map((d) => eventOf(d)) })
  f.service = createCycleService({
    cycleSettings: { get: async () => null },
    cycleEvents: { list: async () => REGULAR.map((d) => eventOf(d)) },
    observations: { list: async () => [] },
    forecasts: { latest: async () => { throw pgError }, insert: async () => assert.fail('must not insert after a failed read') },
  })
  await assert.rejects(f.service.getToday(DB, '2026-06-01'), (e) => e === pgError)
})

test('service source: no HTTP, no AI, no service role, no clock, no identity', () => {
  const source = readFileSync(new URL('../src/services/cycleService.js', import.meta.url), 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const forbidden of ['createServiceClient', 'SERVICE_ROLE', 'lib/supabase', 'req.', 'res.', 'Date.now', 'new Date', 'fetch(', 'process.env', 'user_id', 'userId', 'assessPattern', '.update(', '.delete(']) {
    assert.ok(!code.includes(forbidden), `contains "${forbidden}"`)
  }
})
