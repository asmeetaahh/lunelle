import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createApp } from '../src/app.js'
import { createRequireAuth } from '../src/middleware/requireAuth.js'
import { registerRoutes, MOUNT_PATHS } from '../src/routes/index.js'
import { CLIENT_DATE_HEADER } from '../src/lib/clientDate.js'
import * as m from '../src/lib/mappers.js'
import { createFakeSupabase } from './helpers/fakeSupabase.js'
import { API_ROUTES } from '../../shared/api.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const TOKEN = 'valid-token'
const TS = '2026-09-13T14:00:00+00:00'
const TODAY = '2026-06-01'

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const REGULAR = ['2026-01-05', '2026-02-02', '2026-03-02', '2026-03-30', '2026-04-27', '2026-05-25']

const settingsRow = { id: 'cs-1', user_id: USER, reported_cycle_length: 28, reported_period_length: 4, last_period_start: '2026-05-25', created_at: TS, updated_at: TS }
const eventRows = REGULAR.flatMap((date) => [
  { id: `e-${date}`, user_id: USER, type: 'period_start', date, created_at: TS },
  { id: `x-${date}`, user_id: USER, type: 'period_end', date: addDays(date, 3), created_at: TS },
])
const obsRows = REGULAR.slice(0, 5).flatMap((d) => [
  { id: `o-${d}-a`, user_id: USER, date: addDays(d, 20), mood: 2, energy: 2, symptoms: ['cramps'], note: null, created_at: TS, updated_at: TS },
  ...[1, 3, 5, 8, 11].map((n) => ({ id: `o-${d}-${n}`, user_id: USER, date: addDays(d, n), mood: null, energy: 3, symptoms: [], note: null, created_at: TS, updated_at: TS })),
])

/** Query order in youService: settings → events → observations → pattern_evidence.list → upsertMany. */
const happyPath = () => [
  { data: settingsRow, error: null },
  { data: eventRows, error: null },
  { data: obsRows, error: null },
  { data: [], error: null },
  { data: [], error: null },
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

async function get(base, { token = TOKEN, clientDate = TODAY, query = '' } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  if (clientDate !== null) headers[CLIENT_DATE_HEADER] = clientDate
  const response = await fetch(`${base}/api/you${query}`, { headers })
  const text = await response.text()
  return { status: response.status, text, body: text ? JSON.parse(text) : undefined }
}

const sharedSrc = readFileSync(new URL('../../shared/types.ts', import.meta.url), 'utf8')
const sharedKeys = (name) => [...sharedSrc.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))[1].matchAll(/^ {2}([a-zA-Z0-9]+)\??:/gm)].map((x) => x[1]).sort()

const noLeak = (text) => {
  for (const leak of [USER, 'user_id', 'userId', 'computed_at', 'computedAt', 'pattern_type', 'patternType', 'confidence_tier', 'confidenceTier', 'rangeStart', 'range_start', 'model_version', 'modelVersion', '"id":"p-', 'constraint', 'select ', 'Bearer ', TOKEN]) {
    assert.ok(!text.includes(leak), `response leaked "${leak}"`)
  }
}

test('/api/you is mounted at the frozen path', () => {
  assert.equal(MOUNT_PATHS.you, API_ROUTES.you)
})

test('GET /api/you: 401 without or with a bad bearer; nothing reaches the database', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const missing = await get(base, { token: null })
    assert.equal(missing.status, 401)
    assert.equal(missing.body.code, 'missing_authorization')
    const bad = await get(base, { token: 'nope' })
    assert.equal(bad.status, 401)
    assert.equal(bad.body.code, 'invalid_token')
  })
  assert.equal(calls.length, 0)
})

test('GET /api/you: happy path — exact envelope, exact frozen keys at every level, no internals, evidence persisted', async () => {
  const { app, calls } = build(happyPath())
  await withServer(app, async (base) => {
    const r = await get(base)
    assert.equal(r.status, 200)
    assert.deepEqual(Object.keys(r.body).sort(), ['data', 'success'])
    assert.equal(r.body.success, true)
    const data = r.body.data
    assert.deepEqual(Object.keys(data).sort(), sharedKeys('YouSnapshot'))
    assert.deepEqual(Object.keys(data.stats).sort(), sharedKeys('CycleStats'))
    for (const c of data.cycles) assert.deepEqual(Object.keys(c).sort(), sharedKeys('CycleSummary'))
    assert.ok(data.patterns.length >= 1)
    for (const p of data.patterns) {
      assert.deepEqual(Object.keys(p).sort(), sharedKeys('PatternAssessment'))
      assert.deepEqual(Object.keys(p.target).sort(), ['key', 'kind'])
      for (const e of p.evidence) assert.deepEqual(Object.keys(e).sort(), sharedKeys('CycleEvidence'))
      assert.notEqual(p.tier, 'none')
    }
    assert.deepEqual(data.stats, { cycleLengths: [28, 28, 28, 28, 28], sampleSize: 5, typicalLength: 28, lengthSource: 'history', meanLength: 28, stdDev: 0, regularity: 'regular', lastPeriodStart: '2026-05-25' })
    assert.deepEqual(data.cycles[0], { startDate: '2026-05-25', endDate: null, cycleLength: null, periodLength: 4, isCurrent: true })
    assert.deepEqual(data.cycles[5], { startDate: '2026-01-05', endDate: '2026-02-01', cycleLength: 28, periodLength: 4, isCurrent: false })
    assert.deepEqual(data.patterns.map((p) => [p.target.kind, p.target.key, p.tier]), [['symptom', 'cramps', 'established'], ['mood', 'low', 'established']])
    noLeak(r.text)
  })
  assert.deepEqual(calls.map((c) => c.table), ['cycle_settings', 'cycle_events', 'daily_observations', 'pattern_evidence', 'pattern_evidence'])
  assert.deepEqual(calls[1].chain, [['select', m.CYCLE_EVENT_COLUMNS], ['lte', 'date', TODAY], ['order', 'date', { ascending: true }], ['order', 'type', { ascending: true }]])
  assert.deepEqual(calls[2].chain, [['select', m.OBSERVATION_COLUMNS], ['lte', 'date', TODAY], ['order', 'date', { ascending: true }]])
  const [rows, opts] = calls[4].chain[0].slice(1)
  assert.deepEqual(opts, { onConflict: 'user_id,pattern_type,signal' })
  assert.equal(rows.length, 2)
  assert.deepEqual(Object.keys(rows[0]).sort(), ['assessable_cycles', 'computed_at', 'confidence_tier', 'consistency', 'evidence', 'pattern_type', 'phase', 'range_end', 'range_start', 'signal', 'supporting_cycles'])
  assert.match(rows[0].computed_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'server UTC timestamp')
  assert.notEqual(rows[0].computed_at.slice(0, 10), TODAY, 'computed_at is not the client calendar date')
})

test('GET /api/you: query parameters are rejected (frozen route has none)', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    for (const query of [`?user_id=${USER}`, '?date=2026-06-01', '?userId=x']) {
      const r = await get(base, { query })
      assert.equal(r.status, 400, query)
      assert.equal(r.body.code, 'validation_error')
    }
  })
  assert.equal(calls.length, 0)
})

test('GET /api/you: X-Client-Date decides the current cycle; malformed header → 400; absent header uses server date', async () => {
  const early = build([{ data: settingsRow, error: null }, { data: eventRows, error: null }, { data: obsRows, error: null }, { data: [], error: null }, { data: [], error: null }])
  await withServer(early.app, async (base) => {
    const r = await get(base, { clientDate: '2026-04-01' })
    assert.equal(r.status, 200)
    // On 2026-04-01 the period that started 03-30 has not ended yet (its end is logged 04-02) → periodLength null.
    assert.deepEqual(r.body.data.cycles[0], { startDate: '2026-03-30', endDate: null, cycleLength: null, periodLength: null, isCurrent: true })
    assert.equal(r.body.data.cycles.length, 4)
    const bad = await get(base, { clientDate: '01/04/2026' })
    assert.equal(bad.status, 400)
    assert.equal(bad.body.code, 'validation_error')
  })
  assert.deepEqual(early.calls[1].chain[1], ['lte', 'date', '2026-04-01'])

  const fallback = build([{ data: null, error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }])
  await withServer(fallback.app, async (base) => {
    const r = await get(base, { clientDate: null })
    assert.equal(r.status, 200)
    assert.deepEqual(r.body.data, { stats: { cycleLengths: [], sampleSize: 0, typicalLength: 28, lengthSource: 'default', meanLength: null, stdDev: null, regularity: 'insufficient', lastPeriodStart: null }, cycles: [], patterns: [] })
  })
  assert.equal(fallback.calls[1].chain[1][2], new Date().toISOString().slice(0, 10))
})

test('GET /api/you: database errors are mapped without leaking SQL, tokens or secrets', async () => {
  const { app, logs } = build([{ data: null, error: { code: '42501', message: 'permission denied for table cycle_settings' } }])
  await withServer(app, async (base) => {
    const r = await get(base)
    assert.equal(r.status, 404)
    assert.deepEqual(r.body, { success: false, code: 'not_found', message: 'Not found' })
    noLeak(r.text)
  })
  assert.equal(logs.length, 0)

  const crash = build([
    { data: settingsRow, error: null },
    { data: eventRows, error: null },
    { data: obsRows, error: null },
    { data: null, error: { code: 'XX000', message: `select * from pattern_evidence failed; Authorization: Bearer ${TOKEN}; SUPABASE_SERVICE_ROLE_KEY=sb_secret_zzz` } },
  ])
  await withServer(crash.app, async (base) => {
    const r = await get(base)
    assert.equal(r.status, 500)
    assert.deepEqual(r.body, { success: false, code: 'internal', message: 'Internal server error' })
    noLeak(r.text)
    assert.ok(!r.text.includes('sb_secret'))
  })
  assert.equal(crash.logs.length, 1)
  assert.ok(!crash.logs[0].includes(TOKEN) && !crash.logs[0].includes('sb_secret_zzz'))
})
