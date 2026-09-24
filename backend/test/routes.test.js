import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createApp } from '../src/app.js'
import { createRequireAuth } from '../src/middleware/requireAuth.js'
import { registerRoutes, MOUNT_PATHS } from '../src/routes/index.js'
import { DELETE_OWN_ACCOUNT_FN } from '../src/routes/account.js'
import { CLIENT_DATE_HEADER, clientDate, addDays } from '../src/lib/clientDate.js'
import * as m from '../src/lib/mappers.js'
import { createFakeSupabase } from './helpers/fakeSupabase.js'
import { API_ROUTES } from '../../shared/api.ts'

const USER = '11111111-1111-1111-1111-111111111111'
const TOKEN = 'valid-token'
const TS = '2026-09-13T14:00:00+00:00'
const TODAY = '2026-09-13'
const UUID = '22222222-2222-4222-8222-222222222222'

/**
 * App with the real routers, real requireAuth flow (fake token verification),
 * and a fake Supabase client whose responses are queued per test.
 */
function build(responses = []) {
  const fake = createFakeSupabase(responses)
  const seenTokens = []
  const requireAuth = createRequireAuth({
    createUserClient: (token) => {
      seenTokens.push(token)
      return {
        ...fake.client,
        auth: { getUser: async (t) => (t === TOKEN ? { data: { user: { id: USER, email: 'a@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
      }
    },
  })
  const app = createApp({ logger: { error: () => {} }, routes: (a, ctx) => registerRoutes(a, { ...ctx, requireAuth }) })
  return { app, calls: fake.calls, seenTokens }
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

async function call(base, method, path, { body, token = TOKEN, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      [CLIENT_DATE_HEADER]: TODAY,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { status: response.status, headers: response.headers, text, body: text ? JSON.parse(text) : undefined }
}

const noLeak = (text) => {
  for (const leak of [USER, 'user_id', 'constraint', 'duplicate key', 'row-level', 'select ', 'Bearer ', TOKEN]) {
    assert.ok(!text.includes(leak), `response leaked "${leak}"`)
  }
}

// ---------------------------------------------------------------------------
// Mounting and auth
// ---------------------------------------------------------------------------

test('routers are mounted at exactly the frozen API_ROUTES paths', () => {
  assert.equal(MOUNT_PATHS.cycleSettings, API_ROUTES.cycleSettings)
  assert.equal(MOUNT_PATHS.cycleEvents, API_ROUTES.cycleEvents)
  assert.equal(MOUNT_PATHS.observations, API_ROUTES.observations)
  assert.equal(MOUNT_PATHS.subscription, API_ROUTES.subscription)
  assert.equal(MOUNT_PATHS.account, API_ROUTES.account)
  assert.equal(API_ROUTES.observation('2026-09-13'), `${MOUNT_PATHS.observations}/2026-09-13`)
  assert.equal(API_ROUTES.cycleEvent(UUID), `${MOUNT_PATHS.cycleEvents}/${UUID}`)
})

test('every authenticated route rejects a missing or invalid bearer before touching the database', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const routes = [
      ['GET', '/api/cycle-settings'], ['PUT', '/api/cycle-settings'],
      ['GET', '/api/cycle-events'], ['POST', '/api/cycle-events'], ['DELETE', `/api/cycle-events/${UUID}`],
      ['GET', '/api/observations'], ['PUT', '/api/observations/2026-09-13'],
      ['GET', '/api/subscription'], ['DELETE', '/api/account'],
    ]
    for (const [method, path] of routes) {
      const missing = await call(base, method, path, { token: null })
      assert.equal(missing.status, 401, `${method} ${path}`)
      assert.equal(missing.body.code, 'missing_authorization')
      assert.equal(missing.headers.get('www-authenticate'), 'Bearer')
      const bad = await call(base, method, path, { token: 'expired' })
      assert.equal(bad.status, 401)
      assert.equal(bad.body.code, 'invalid_token')
      noLeak(bad.text)
    }
  })
  assert.equal(calls.length, 0, 'no query reached the database')
})

test('health stays public and un-enveloped by auth', async () => {
  const { app } = build()
  await withServer(app, async (base) => {
    const r = await call(base, 'GET', '/api/health', { token: null })
    assert.equal(r.status, 200)
    assert.equal(r.body.success, true)
  })
})

// ---------------------------------------------------------------------------
// cycle-settings
// ---------------------------------------------------------------------------

const settingsRow = { id: 'cs-1', user_id: USER, reported_cycle_length: 28, reported_period_length: null, last_period_start: '2026-08-14', created_at: TS, updated_at: TS }

test('GET /api/cycle-settings → CycleSettings, or data:null before onboarding', async () => {
  const { app, calls } = build([{ data: settingsRow, error: null }, { data: null, error: null }])
  await withServer(app, async (base) => {
    const r = await call(base, 'GET', '/api/cycle-settings')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { success: true, data: m.toCycleSettings(settingsRow) })
    noLeak(r.text)
    const none = await call(base, 'GET', '/api/cycle-settings')
    assert.deepEqual(none.body, { success: true, data: null })
  })
  assert.equal(calls[0].table, 'cycle_settings')
})

test('PUT /api/cycle-settings: upsert + period_start sync, exact queries, partial merge', async () => {
  const { app, calls } = build([
    { data: settingsRow, error: null }, // settings upsert
    { data: [], error: null }, // events.list → none yet
    { data: { id: 'e-1', user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS }, error: null }, // events.insert
  ])
  await withServer(app, async (base) => {
    const r = await call(base, 'PUT', '/api/cycle-settings', { body: { reportedCycleLength: 28, lastPeriodStart: '2026-08-14' } })
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { success: true, data: m.toCycleSettings(settingsRow) })
    noLeak(r.text)
  })
  assert.deepEqual(calls.map((c) => c.table), ['cycle_settings', 'cycle_events', 'cycle_events'])
  assert.deepEqual(calls[0].chain[0], ['upsert', { reported_cycle_length: 28, last_period_start: '2026-08-14' }, { onConflict: 'user_id' }])
  assert.deepEqual(calls[2].chain[0], ['insert', { type: 'period_start', date: '2026-08-14' }])
})

test('PUT /api/cycle-settings: repeated submission is idempotent (no second event insert)', async () => {
  const existing = { id: 'e-1', user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS }
  const { app, calls } = build([{ data: settingsRow, error: null }, { data: [existing], error: null }])
  await withServer(app, async (base) => {
    const r = await call(base, 'PUT', '/api/cycle-settings', { body: { reportedCycleLength: 28, lastPeriodStart: '2026-08-14' } })
    assert.equal(r.status, 200)
  })
  assert.deepEqual(calls.map((c) => c.table), ['cycle_settings', 'cycle_events'])
  assert.ok(!calls[1].chain.some(([mth]) => mth === 'insert'))
})

test('PUT /api/cycle-settings: validation, future dates, attacker user_id', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const empty = await call(base, 'PUT', '/api/cycle-settings', { body: {} })
    assert.equal(empty.status, 400)
    assert.equal(empty.body.code, 'validation_error')

    const range = await call(base, 'PUT', '/api/cycle-settings', { body: { reportedCycleLength: 61 } })
    assert.equal(range.status, 400)
    assert.deepEqual(range.body.details.map((d) => `${d.in}:${d.path}`), ['body:reportedCycleLength'])

    const bad = await call(base, 'PUT', '/api/cycle-settings', { body: { lastPeriodStart: '2026-02-30' } })
    assert.equal(bad.status, 400)

    const future = await call(base, 'PUT', '/api/cycle-settings', { body: { lastPeriodStart: addDays(TODAY, 1) } })
    assert.equal(future.status, 400)
    assert.equal(future.body.code, 'validation_error')
    assert.deepEqual(future.body.details, [{ in: 'body', path: 'lastPeriodStart', message: 'must not be after today' }])

    const attacker = await call(base, 'PUT', '/api/cycle-settings', { body: { reportedCycleLength: 28, user_id: '99999999-9999-4999-8999-999999999999' } })
    assert.equal(attacker.status, 400)
    assert.equal(attacker.body.code, 'validation_error')
  })
  assert.equal(calls.length, 0, 'nothing invalid reached the database')
})

// ---------------------------------------------------------------------------
// cycle-events
// ---------------------------------------------------------------------------

const eventRow = { id: UUID, user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS }

test('GET /api/cycle-events: filters pass through, ascending order, contract shape', async () => {
  const { app, calls } = build([{ data: [eventRow], error: null }])
  await withServer(app, async (base) => {
    const r = await call(base, 'GET', '/api/cycle-events?from=2026-01-01&to=2026-12-31&type=period_start')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { success: true, data: [m.toCycleEvent(eventRow)] })
    noLeak(r.text)
    const badRange = await call(base, 'GET', '/api/cycle-events?from=2026-02-01&to=2026-01-01')
    assert.equal(badRange.status, 400)
  })
  assert.deepEqual(calls[0].chain, [
    ['select', m.CYCLE_EVENT_COLUMNS],
    ['gte', 'date', '2026-01-01'],
    ['lte', 'date', '2026-12-31'],
    ['eq', 'type', 'period_start'],
    ['order', 'date', { ascending: true }],
    ['order', 'type', { ascending: true }],
  ])
})

test('POST /api/cycle-events: 201 envelope, 409 on duplicate, 400 on invalid/future/attacker input', async () => {
  const { app, calls } = build([
    { data: eventRow, error: null },
    { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "cycle_events_unique_per_day"', details: `Key (user_id, type, date)=(${USER}, period_start, 2026-08-14) already exists.` } },
  ])
  await withServer(app, async (base) => {
    const ok = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: '2026-08-14' } })
    assert.equal(ok.status, 201)
    assert.deepEqual(ok.body, { success: true, data: m.toCycleEvent(eventRow) })
    noLeak(ok.text)

    const dup = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: '2026-08-14' } })
    assert.equal(dup.status, 409)
    assert.deepEqual(dup.body, { success: false, code: 'conflict', message: 'Resource already exists' })
    noLeak(dup.text)

    const future = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: addDays(TODAY, 1) } })
    assert.equal(future.status, 400)
    assert.deepEqual(future.body.details, [{ in: 'body', path: 'date', message: 'must not be after today' }])

    const today = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: TODAY } })
    assert.notEqual(today.status, 400, 'today itself is allowed')

    for (const body of [{ type: 'ovulation', date: '2026-08-14' }, { type: 'period_start', date: '2026-02-30' }, { type: 'period_start', date: '2026-08-14', user_id: USER }, { startDate: '2026-08-14', duration: 5 }]) {
      const r = await call(base, 'POST', '/api/cycle-events', { body })
      assert.equal(r.status, 400, JSON.stringify(body))
      assert.equal(r.body.code, 'validation_error')
    }
  })
  assert.deepEqual(calls[0].chain[0], ['insert', { type: 'period_start', date: '2026-08-14' }])
  assert.equal(calls.length, 3, 'only the three valid requests reached the database')
})

test('DELETE /api/cycle-events/:id: 204 when deleted, 404 when absent OR not owned, 400 on non-uuid', async () => {
  const { app, calls } = build([{ data: [{ id: UUID }], error: null }, { data: [], error: null }])
  await withServer(app, async (base) => {
    const gone = await call(base, 'DELETE', `/api/cycle-events/${UUID}`)
    assert.equal(gone.status, 204)
    assert.equal(gone.text, '')

    const notMine = await call(base, 'DELETE', `/api/cycle-events/${UUID}`)
    assert.equal(notMine.status, 404)
    assert.deepEqual(notMine.body, { success: false, code: 'not_found', message: 'Cycle event not found' })

    const bad = await call(base, 'DELETE', '/api/cycle-events/p-1')
    assert.equal(bad.status, 400)
  })
  assert.deepEqual(calls[0].chain, [['delete'], ['eq', 'id', UUID], ['select', 'id']])
  assert.equal(calls.length, 2)
})

// ---------------------------------------------------------------------------
// observations
// ---------------------------------------------------------------------------

const obsRow = { id: 'o-1', user_id: USER, date: TODAY, mood: null, energy: 4, symptoms: ['cramps'], note: null, created_at: TS, updated_at: TS }

test('PUT /api/observations/:date: idempotent upsert with exact payload; nulls preserved', async () => {
  const { app, calls } = build([{ data: obsRow, error: null }, { data: obsRow, error: null }])
  await withServer(app, async (base) => {
    const r = await call(base, 'PUT', `/api/observations/${TODAY}`, { body: { mood: null, energy: 4, symptoms: ['cramps'] } })
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { success: true, data: m.toObservation(obsRow) })
    assert.equal(r.body.data.mood, null)
    noLeak(r.text)
    const again = await call(base, 'PUT', `/api/observations/${TODAY}`, { body: { mood: null, energy: 4, symptoms: ['cramps'] } })
    assert.equal(again.status, 200)
  })
  assert.deepEqual(calls[0].chain[0], ['upsert', { date: TODAY, mood: null, energy: 4, symptoms: ['cramps'] }, { onConflict: 'user_id,date' }])
  assert.deepEqual(calls[1].chain[0], calls[0].chain[0], 'second call issues the identical upsert')
})

test('PUT /api/observations/:date: validation — scale, vocabulary, note, empty body, future day, attacker fields', async () => {
  const { app, calls } = build()
  await withServer(app, async (base) => {
    const cases = [
      [`/api/observations/${TODAY}`, { mood: 6 }, 'body:mood'],
      [`/api/observations/${TODAY}`, { energy: 0 }, 'body:energy'],
      [`/api/observations/${TODAY}`, { symptoms: ['unicorns'] }, 'body:symptoms.0'],
      [`/api/observations/${TODAY}`, { symptoms: ['cramps', 'cramps'] }, 'body:symptoms'],
      [`/api/observations/${TODAY}`, { note: 'x'.repeat(501) }, 'body:note'],
      [`/api/observations/${TODAY}`, {}, 'body:'],
      [`/api/observations/${TODAY}`, { mood: 3, user_id: USER }, 'body:'],
      ['/api/observations/2026-02-30', { mood: 3 }, 'params:date'],
    ]
    for (const [path, body, where] of cases) {
      const r = await call(base, 'PUT', path, { body })
      assert.equal(r.status, 400, `${path} ${JSON.stringify(body)}`)
      assert.equal(r.body.code, 'validation_error')
      assert.ok(r.body.details.some((d) => `${d.in}:${d.path}` === where), `${where} in ${JSON.stringify(r.body.details)}`)
    }
    const future = await call(base, 'PUT', `/api/observations/${addDays(TODAY, 1)}`, { body: { mood: 3 } })
    assert.equal(future.status, 400)
    assert.deepEqual(future.body.details, [{ in: 'params', path: 'date', message: 'must not be after today' }])
  })
  assert.equal(calls.length, 0)
})

test('GET /api/observations: 90-day default window from the client date; explicit range; from>to rejected', async () => {
  const { app, calls } = build([{ data: [obsRow], error: null }, { data: [], error: null }, { data: [], error: null }])
  await withServer(app, async (base) => {
    const dflt = await call(base, 'GET', '/api/observations')
    assert.equal(dflt.status, 200)
    assert.deepEqual(dflt.body, { success: true, data: [m.toObservation(obsRow)] })

    await call(base, 'GET', '/api/observations?from=2026-06-01&to=2026-06-30')
    const partial = await call(base, 'GET', '/api/observations?to=2026-06-30')
    assert.equal(partial.status, 200)

    const inverted = await call(base, 'GET', '/api/observations?from=2026-06-02&to=2026-06-01')
    assert.equal(inverted.status, 400)
    const fromAfterToday = await call(base, 'GET', `/api/observations?from=${addDays(TODAY, 5)}`)
    assert.equal(fromAfterToday.status, 400)
    assert.equal(fromAfterToday.body.code, 'validation_error')
  })
  assert.deepEqual(calls[0].chain, [
    ['select', m.OBSERVATION_COLUMNS],
    ['gte', 'date', addDays(TODAY, -90)],
    ['lte', 'date', TODAY],
    ['order', 'date', { ascending: true }],
  ])
  assert.deepEqual(calls[1].chain.slice(1, 3), [['gte', 'date', '2026-06-01'], ['lte', 'date', '2026-06-30']])
  assert.deepEqual(calls[2].chain.slice(1, 3), [['gte', 'date', '2026-04-01'], ['lte', 'date', '2026-06-30']])
  assert.equal(calls.length, 3)
})

// ---------------------------------------------------------------------------
// subscription
// ---------------------------------------------------------------------------

test('GET /api/subscription: read-only, contract shape; no write route exists', async () => {
  const subRow = { user_id: USER, is_plus: false, entitlement: null, source: 'revenuecat', updated_at: TS }
  const { app, calls } = build([{ data: subRow, error: null }, { data: null, error: null }])
  await withServer(app, async (base) => {
    const r = await call(base, 'GET', '/api/subscription')
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { success: true, data: { isPlus: false, entitlement: null, source: 'revenuecat', updatedAt: TS } })
    noLeak(r.text)

    const missing = await call(base, 'GET', '/api/subscription')
    assert.equal(missing.status, 500)
    assert.equal(missing.body.code, 'internal')

    for (const method of ['PUT', 'POST', 'PATCH', 'DELETE']) {
      const w = await call(base, method, '/api/subscription', { body: { isPlus: true, entitlement: 'plus' } })
      assert.equal(w.status, 404, `${method} must not exist`)
      assert.equal(w.body.code, 'not_found')
    }
  })
  assert.deepEqual(calls[0].chain, [['select', m.SUBSCRIPTION_COLUMNS], ['maybeSingle']])
  assert.equal(calls.length, 2, 'write attempts never reach the database')
})

// ---------------------------------------------------------------------------
// account
// ---------------------------------------------------------------------------

test('DELETE /api/account: rpc(delete_own_account) on the caller-scoped client → 204; body with a user id → 400; db error → mapped', async () => {
  const { app, calls, seenTokens } = build([{ data: null, error: null }, { data: null, error: { code: '42501', message: 'permission denied for function delete_own_account' } }])
  await withServer(app, async (base) => {
    const r = await call(base, 'DELETE', '/api/account')
    assert.equal(r.status, 204)
    assert.equal(r.text, '')

    const forged = await call(base, 'DELETE', '/api/account', { body: { userId: '99999999-9999-4999-8999-999999999999' } })
    assert.equal(forged.status, 400)
    assert.equal(forged.body.code, 'validation_error')

    const denied = await call(base, 'DELETE', '/api/account')
    assert.equal(denied.status, 404)
    assert.equal(denied.body.code, 'not_found')
    noLeak(denied.text)
  })
  assert.deepEqual(calls[0], { rpc: DELETE_OWN_ACCOUNT_FN, args: undefined })
  assert.equal(calls.length, 2, 'the forged request never reached the database')
  assert.ok(seenTokens.every((t) => t === TOKEN), 'client was built from the caller token only')
})

test('DELETE /api/account is behind the strict limiter', async () => {
  const fake = createFakeSupabase(Array(5).fill({ data: null, error: null }))
  const requireAuth = createRequireAuth({
    createUserClient: () => ({ ...fake.client, auth: { getUser: async () => ({ data: { user: { id: USER } }, error: null }) } }),
  })
  const app = createApp({
    rateLimit: { strict: { limit: 2, windowMs: 60_000 } },
    routes: (a, ctx) => registerRoutes(a, { ...ctx, requireAuth }),
  })
  await withServer(app, async (base) => {
    const statuses = []
    for (let i = 0; i < 3; i += 1) statuses.push((await call(base, 'DELETE', '/api/account')).status)
    assert.deepEqual(statuses, [204, 204, 429])
  })
})

// ---------------------------------------------------------------------------
// client date
// ---------------------------------------------------------------------------

test('clientDate: header is exact; absence falls back to server UTC date with one day of tolerance; malformed header → 400', () => {
  const req = (h) => ({ get: () => h })
  assert.deepEqual(clientDate(req('2026-09-13')), { today: '2026-09-13', latestAllowed: '2026-09-13', source: 'header' })
  const fixed = () => new Date('2026-09-13T23:30:00Z')
  assert.deepEqual(clientDate(req(undefined), { now: fixed }), { today: '2026-09-13', latestAllowed: '2026-09-14', source: 'server' })
  assert.throws(() => clientDate(req('13/09/2026')), (e) => e.name === 'ApiError' && e.code === 'validation_error' && e.status === 400)
  assert.throws(() => clientDate(req('2026-02-30')), (e) => e.code === 'validation_error')
})

test('without X-Client-Date, tomorrow (UTC) is tolerated but the day after is not', async () => {
  const { app } = build([{ data: eventRow, error: null }])
  const utcToday = new Date().toISOString().slice(0, 10)
  await withServer(app, async (base) => {
    const r1 = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: addDays(utcToday, 1) }, headers: { [CLIENT_DATE_HEADER]: '' } })
    assert.equal(r1.status, 201)
    const r2 = await call(base, 'POST', '/api/cycle-events', { body: { type: 'period_start', date: addDays(utcToday, 2) }, headers: { [CLIENT_DATE_HEADER]: '' } })
    assert.equal(r2.status, 400)
  })
})

// ---------------------------------------------------------------------------
// Security scan of the new layers
// ---------------------------------------------------------------------------

test('routes, schemas and services never use the service client, trust user ids, or do engine/AI work', async () => {
  for (const dir of ['routes', 'schemas', 'services']) {
    const url = new URL(`../src/${dir}/`, import.meta.url)
    for (const file of (await readdir(url)).filter((f) => f.endsWith('.js'))) {
      const raw = await readFile(new URL(file, url), 'utf8')
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      const forbidden = ['createServiceClient', 'SERVICE_ROLE', 'lib/supabase', 'createClient(', 'req.body.user_id', 'req.body.userId', 'req.user.id', 'fetch(', 'process.env']
      // Engines are *executed* only from services (cycleService is the orchestrator). Schemas may import engine
      // constants/validators (SYMPTOM_KEYS, isISODate, length bounds) — that is the pinning design, not computation.
      if (dir !== 'services') forbidden.push('assessPattern', 'assessAllPatterns', 'forecastCycles', 'computeCycleStats', 'locateCycleDay')
      for (const token of forbidden) {
        assert.ok(!code.includes(token), `${dir}/${file} contains "${token}"`)
      }
    }
  }
})
