import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createApp } from '../src/app.js'
import { createRequireAuth } from '../src/middleware/requireAuth.js'
import { registerRoutes, MOUNT_PATHS } from '../src/routes/index.js'
import { CLIENT_DATE_HEADER } from '../src/lib/clientDate.js'
import * as m from '../src/lib/mappers.js'
import * as cycle from '../src/engines/cycle.js'
import { createFakeSupabase } from './helpers/fakeSupabase.js'
import { API_ROUTES } from '../../shared/api.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const TOKEN = 'valid-token'
const TS = '2026-09-13T14:00:00+00:00'
const TODAY = '2026-06-01'

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const REGULAR = ['2026-01-05', '2026-02-02', '2026-03-02', '2026-03-30', '2026-04-27', '2026-05-25']

const settingsRow = { id: 'cs-1', user_id: USER, reported_cycle_length: 28, reported_period_length: 5, last_period_start: '2026-05-25', created_at: TS, updated_at: TS }
const eventRows = REGULAR.map((date) => ({ id: `e-${date}`, user_id: USER, type: 'period_start', date, created_at: TS }))
const obsRows = [
  { id: 'o-1', user_id: USER, date: addDays(TODAY, -40), mood: 2, energy: 2, symptoms: ['fatigue'], note: null, created_at: TS, updated_at: TS },
  { id: 'o-2', user_id: USER, date: TODAY, mood: 4, energy: 3, symptoms: ['cramps'], note: 'ok', created_at: TS, updated_at: TS },
]
const forecastRow = {
  id: 'f-1', user_id: USER, window_start: '2026-06-21', window_end: '2026-06-23', expected_period_date: '2026-06-22',
  period_uncertainty_days: 1, window_offset_uncertainty_days: 0, basis: 'observed_cycle', generated_at: TS, model_version: 'cycle-1',
}

/** Query order in cycleService: settings → period_start events → observations → forecasts.latest → forecasts.insert. */
const happyPath = () => [
  { data: settingsRow, error: null },
  { data: eventRows, error: null },
  { data: obsRows, error: null },
  { data: null, error: null },
  { data: forecastRow, error: null },
]

function build(responses = []) {
  const fake = createFakeSupabase(responses)
  const requireAuth = createRequireAuth({
    createUserClient: () => ({
      ...fake.client,
      auth: { getUser: async (t) => (t === TOKEN ? { data: { user: { id: USER, email: 'a@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    }),
  })
  const logs = []
  const app = createApp({ logger: { error: (l) => logs.push(l) }, routes: (a, ctx) => registerRoutes(a, { ...ctx, requireAuth }) })
  return { app, calls: fake.calls, logs }
}

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

async function get(base, query, { token = TOKEN, clientDate = TODAY } = {}) {
  const response = await fetch(`${base}/api/today${query}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), [CLIENT_DATE_HEADER]: clientDate },
  })
  const text = await response.text()
  return { status: response.status, text, body: text ? JSON.parse(text) : undefined }
}

/** Keys of the frozen TodaySnapshot, parsed from shared/types.ts. */
const sharedSrc = readFileSync(new URL('../../shared/types.ts', import.meta.url), 'utf8')
// Top-level properties only (two-space indent); nested object members like loggedDays.total are skipped.
const sharedKeys = (name) => [...sharedSrc.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))[1].matchAll(/^ {2}([a-zA-Z0-9]+)\??:/gm)].map((x) => x[1]).sort()

const noLeak = (text) => {
  for (const leak of [USER, 'user_id', 'userId', 'constraint', 'select ', 'Bearer ', TOKEN, 'window_start', 'windowOffsetUncertaintyDays', 'model_version', 'modelVersion']) {
    assert.ok(!text.includes(leak), `response leaked "${leak}"`)
  }
}

test('/api/today is mounted at the frozen path', () => {
  assert.equal(MOUNT_PATHS.today, API_ROUTES.today)
})

test('GET /api/today: 401 without or with a bad bearer, nothing reaches the database', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const missing = await get(base, `?date=${TODAY}`, { token: null })
    assert.equal(missing.status, 401)
    assert.equal(missing.body.code, 'missing_authorization')
    const bad = await get(base, `?date=${TODAY}`, { token: 'nope' })
    assert.equal(bad.status, 401)
    assert.equal(bad.body.code, 'invalid_token')
  })
  assert.equal(calls.length, 0)
})

test('GET /api/today: date validation — required, real calendar day, not in the future, no extra keys', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const cases = [
      ['', 'query:date'],
      ['?date=', 'query:date'],
      ['?date=2026-02-30', 'query:date'],
      ['?date=06/01/2026', 'query:date'],
      [`?date=${TODAY}&user_id=${USER}`, 'query:'],
      [`?date=${TODAY}&userId=${USER}`, 'query:'],
    ]
    for (const [query, where] of cases) {
      const r = await get(base, query)
      assert.equal(r.status, 400, query)
      assert.equal(r.body.code, 'validation_error')
      assert.ok(r.body.details.some((d) => `${d.in}:${d.path}` === where), `${query} → ${JSON.stringify(r.body.details)}`)
    }
    const future = await get(base, `?date=${addDays(TODAY, 1)}`)
    assert.equal(future.status, 400)
    assert.deepEqual(future.body.details, [{ in: 'query', path: 'date', message: 'must not be after today' }])
    const badHeader = await get(base, `?date=${TODAY}`, { clientDate: 'yesterday' })
    assert.equal(badHeader.status, 400)
  })
  assert.equal(calls.length, 0)
})

test('GET /api/today: envelope, exact frozen TodaySnapshot keys, fresh forecast, snapshot persisted, no leakage', async () => {
  const { app, calls } = build(happyPath())
  await withServer(app, async (base) => {
    const r = await get(base, `?date=${TODAY}`)
    assert.equal(r.status, 200)
    assert.equal(r.body.success, true)
    assert.deepEqual(Object.keys(r.body).sort(), ['data', 'success'])
    const data = r.body.data
    assert.deepEqual(Object.keys(data).sort(), sharedKeys('TodaySnapshot'))
    assert.deepEqual(Object.keys(data.position).sort(), sharedKeys('CyclePosition'))
    assert.deepEqual(Object.keys(data.nextPeriod).sort(), sharedKeys('PredictedPeriod'))
    assert.deepEqual(Object.keys(data.todayObservation).sort(), sharedKeys('DailyObservation'))
    assert.deepEqual(data, {
      date: TODAY,
      hasCycleSettings: true,
      position: { cycleDay: 8, phase: 'follicular', typicalLength: 28, isOverdue: false, isEstimated: false, confidence: 'high' },
      nextPeriod: { ordinal: 1, expectedStart: '2026-06-22', earliestStart: '2026-06-21', latestStart: '2026-06-23', uncertaintyDays: 1, confidence: 'high' },
      forecastBasis: 'observed_cycle',
      caveats: [],
      loggedDays: { total: 2, last30: 1 },
      todayObservation: m.toObservation(obsRows[1]),
    })
    noLeak(r.text)
  })
  assert.deepEqual(calls.map((c) => c.table), ['cycle_settings', 'cycle_events', 'daily_observations', 'forecasts', 'forecasts'])
  assert.deepEqual(calls[1].chain, [
    ['select', m.CYCLE_EVENT_COLUMNS],
    ['lte', 'date', TODAY],
    ['eq', 'type', 'period_start'],
    ['order', 'date', { ascending: true }],
    ['order', 'type', { ascending: true }],
  ])
  assert.deepEqual(calls[3].chain, [['select', m.FORECAST_COLUMNS], ['order', 'generated_at', { ascending: false }], ['limit', 1], ['maybeSingle']])
  assert.deepEqual(calls[4].chain[0], [
    'insert',
    { window_start: '2026-06-21', window_end: '2026-06-23', expected_period_date: '2026-06-22', period_uncertainty_days: 1, window_offset_uncertainty_days: 0, basis: 'observed_cycle', model_version: cycle.MODEL_VERSION },
  ])
})

test('GET /api/today: identical stored snapshot → no insert; onboarding state → no forecast queries at all', async () => {
  const same = build([{ data: settingsRow, error: null }, { data: eventRows, error: null }, { data: obsRows, error: null }, { data: forecastRow, error: null }])
  await withServer(same.app, async (base) => {
    const r = await get(base, `?date=${TODAY}`)
    assert.equal(r.status, 200)
    assert.equal(r.body.data.forecastBasis, 'observed_cycle')
  })
  assert.deepEqual(same.calls.map((c) => c.table), ['cycle_settings', 'cycle_events', 'daily_observations', 'forecasts'])

  const fresh = build([{ data: null, error: null }, { data: [], error: null }, { data: [], error: null }])
  await withServer(fresh.app, async (base) => {
    const r = await get(base, `?date=${TODAY}`)
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.data, {
      date: TODAY,
      hasCycleSettings: false,
      position: { cycleDay: null, phase: 'unknown', typicalLength: 28, isOverdue: false, isEstimated: true, confidence: 'low' },
      nextPeriod: null,
      forecastBasis: null,
      caveats: [cycle.CAVEATS.noBasis],
      loggedDays: { total: 0, last30: 0 },
      todayObservation: null,
    })
  })
  assert.deepEqual(fresh.calls.map((c) => c.table), ['cycle_settings', 'cycle_events', 'daily_observations'])
})

test('GET /api/today: database errors are mapped and never leak SQL, tokens or secrets', async () => {
  const { app, logs } = build([
    { data: null, error: { code: '42501', message: 'permission denied for table cycle_settings' } },
  ])
  await withServer(app, async (base) => {
    const rls = await get(base, `?date=${TODAY}`)
    assert.equal(rls.status, 404)
    assert.deepEqual(rls.body, { success: false, code: 'not_found', message: 'Not found' })
    noLeak(rls.text)
  })

  const crash = build([
    { data: settingsRow, error: null },
    { data: eventRows, error: null },
    { data: obsRows, error: null },
    { data: null, error: { code: 'XX000', message: `internal error near "select * from forecasts" token=Bearer ${TOKEN} SUPABASE_SERVICE_ROLE_KEY=sb_secret_abc123` } },
  ])
  await withServer(crash.app, async (base) => {
    const r = await get(base, `?date=${TODAY}`)
    assert.equal(r.status, 500)
    assert.deepEqual(r.body, { success: false, code: 'internal', message: 'Internal server error' })
    noLeak(r.text)
    assert.ok(!r.text.includes('sb_secret'))
  })
  assert.equal(crash.logs.length, 1)
  assert.ok(!crash.logs[0].includes(TOKEN) && !crash.logs[0].includes('sb_secret_abc123'), 'log line redacted')
  assert.equal(logs.length, 0, 'mapped errors are not logged')
})
