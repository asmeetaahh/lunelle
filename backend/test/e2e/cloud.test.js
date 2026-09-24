/**
 * CLOUD E2E ACCEPTANCE TEST — runs against the LINKED Supabase project.
 *
 * Skipped unless LUNELLE_CLOUD_E2E=1 (npm run test:e2e:cloud). Needs backend/.env.
 *
 * What it does:
 *   - creates two temporary Auth users (admin API, service role — setup only)
 *   - boots the real backend (node src/server.js, backend/.env) on a free port
 *   - drives the HTTP API with the users' JWTs only
 *   - verifies isolation, bootstrap rows, forecasts/patterns, account deletion
 *     and cascades (service role — verification only, never as an API bearer)
 *   - deletes only the users and rows it created; fingerprints unrelated data
 *
 * Nothing secret is ever printed: tokens, keys and passwords are kept in
 * closures, every printed string passes through `redact()`, and the report
 * counts how many redactions were needed (must be zero).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { createClient } from '@supabase/supabase-js'
import '../../src/config/env.js' // loads backend/.env via dotenv (does not validate yet)

const ENABLED = process.env.LUNELLE_CLOUD_E2E === '1'
const RUN_ID = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const TODAY = new Date().toISOString().slice(0, 10)
const day = (offset) => new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
const BACKEND_DIR = fileURLToPath(new URL('../..', import.meta.url))
const TABLES = ['profiles', 'cycle_settings', 'cycle_events', 'daily_observations', 'journal_entries', 'forecasts', 'pattern_evidence', 'subscription_state']
const LEGACY_TABLE = 'journals'

// ---------------------------------------------------------------------------
// Secret handling
// ---------------------------------------------------------------------------

const secrets = new Set()
const guard = (value) => {
  if (typeof value === 'string' && value.length >= 8) secrets.add(value)
  return value
}
let redactions = 0
function redact(text) {
  let out = String(text)
  for (const s of secrets) {
    if (out.includes(s)) {
      redactions += out.split(s).length - 1
      out = out.split(s).join('[REDACTED]')
    }
  }
  return out.replace(/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, () => (redactions += 1, '[REDACTED-JWT]'))
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const CRITERIA = [
  [1, 'Create temporary User A through Supabase Auth'],
  [2, 'Create temporary User B through Supabase Auth'],
  [3, 'Obtain valid JWT access tokens for both'],
  [4, 'Start the real Lunelle backend using backend/.env'],
  [5, 'A authenticated request succeeds'],
  [6, 'B authenticated request succeeds'],
  [7, 'A can create cycle settings/events/observations through the API'],
  [8, 'B can create cycle settings/events/observations through the API'],
  [9, "A can read only A's data"],
  [10, "B can read only B's data"],
  [11, "A cannot read B's records, including by supplying B-owned IDs"],
  [12, "B cannot read A's records, including by supplying A-owned IDs"],
  [13, 'A cannot reassign ownership through any accepted request field'],
  [14, 'Unauthenticated requests return 401'],
  [15, 'Invalid JWT returns 401'],
  [16, '/api/today works against the real Supabase database for A'],
  [17, '/api/you works against the real Supabase database for A'],
  [18, "Signup bootstrap creates A's public.profiles row"],
  [19, "Signup bootstrap creates A's public.subscription_state row"],
  [20, "Signup bootstrap creates B's public.profiles row"],
  [21, "Signup bootstrap creates B's public.subscription_state row"],
  [22, 'DELETE /api/account for A succeeds'],
  [23, "After A deletion, A's profiles row is gone"],
  [24, "After A deletion, A's cycle_settings row is gone"],
  [25, "After A deletion, A's cycle_events rows are gone"],
  [26, "After A deletion, A's daily_observations rows are gone"],
  [27, "After A deletion, A's forecasts rows are gone"],
  [28, "After A deletion, A's pattern_evidence rows are gone"],
  [29, "After A deletion, A's subscription_state row is gone"],
  [30, 'User B remains intact after A deletion'],
  [31, 'Existing legacy public.journals table is not modified or deleted'],
  [32, 'No service-role credential is ever sent to the client-facing API as a bearer'],
  [33, 'Test cleanup removes only the temporary test user(s) and test data'],
  [34, 'Never delete or modify unrelated users/data'],
  [35, 'Never print JWTs, API keys, service-role keys, passwords, or other secrets'],
  [36, 'Report every criterion explicitly as PASS, FAIL, or BLOCKED'],
  [37, 'On failure, preserve enough non-secret evidence to diagnose the issue'],
]
const results = new Map(CRITERIA.map(([id]) => [id, { status: 'BLOCKED', evidence: 'not reached' }]))
const evidenceLog = []
const note = (msg, data) => evidenceLog.push({ t: new Date().toISOString(), msg: redact(msg), data: data === undefined ? undefined : JSON.parse(redact(JSON.stringify(data))) })

async function check(id, fn) {
  try {
    const evidence = await fn()
    results.set(id, { status: 'PASS', evidence: redact(evidence ?? 'ok') })
    return true
  } catch (error) {
    const evidence = redact(error?.evidence ? `${error.message} :: ${JSON.stringify(error.evidence)}` : error?.message ?? String(error))
    results.set(id, { status: 'FAIL', evidence })
    note(`C${id} FAIL`, { evidence })
    return false
  }
}
const fail = (message, evidence) => Object.assign(new Error(message), { evidence })
const block = (ids, why) => ids.forEach((id) => results.get(id).status === 'BLOCKED' && results.set(id, { status: 'BLOCKED', evidence: redact(why) }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function freePort() {
  const s = http.createServer()
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve))
  const { port } = s.address()
  await new Promise((resolve) => s.close(resolve))
  return port
}

function bootBackend(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/server.js'], { cwd: BACKEND_DIR, env: { ...env, PORT: String(port) } })
    let out = ''
    const onData = (d) => {
      out += d
      if (/listening on port \d+/.test(out)) resolve({ child, out: () => out })
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', (code) => reject(fail(`backend exited early with code ${code}`, { output: redact(out).slice(0, 800) })))
    setTimeout(() => reject(fail('backend did not start within 15s', { output: redact(out).slice(0, 800) })), 15_000).unref()
  })
}

test('Lunelle V2 cloud E2E acceptance (linked Supabase project)', { skip: !ENABLED && 'set LUNELLE_CLOUD_E2E=1 to run against the linked Supabase project', timeout: 240_000 }, async () => {
  // ---- configuration (values never printed) -------------------------------
  const url = process.env.SUPABASE_URL
  const anonKey = guard(process.env.SUPABASE_ANON_KEY)
  const serviceKey = guard(process.env.SUPABASE_SERVICE_ROLE_KEY)
  assert.ok(url && anonKey && serviceKey, 'backend/.env must provide SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY')
  // Unimplemented features may be blank in .env; the bootstrap still requires a value.
  const childEnv = {
    PATH: process.env.PATH,
    REVENUECAT_WEBHOOK_SECRET: process.env.REVENUECAT_WEBHOOK_SECRET || 'e2e-placeholder-not-a-secret',
    AI_API_KEY: process.env.AI_API_KEY || 'e2e-placeholder-not-a-secret',
  }
  guard(childEnv.REVENUECAT_WEBHOOK_SECRET)
  guard(childEnv.AI_API_KEY)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const users = { A: null, B: null } // { id, email, password, jwt }
  let backend = null
  let base = null
  const bearersUsed = new Set()

  /** HTTP helper: the ONLY way this test talks to the API. Refuses anything but user JWTs / null / a deliberately invalid token. */
  async function api(who, method, path, body, extraHeaders = {}) {
    let token = null
    if (who === 'A' || who === 'B') token = users[who]?.jwt
    else if (who === 'INVALID') token = 'invalid.token.value'
    else if (who !== null) throw new Error(`api(): unknown principal ${who}`)
    if (token === serviceKey || token === anonKey) throw new Error('refusing to send a key as a bearer')
    if (token) bearersUsed.add(token)
    const headers = { 'x-client-date': TODAY, ...extraHeaders }
    if (token) headers.authorization = `Bearer ${token}`
    if (body !== undefined) headers['content-type'] = 'application/json'
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : undefined }
  }
  const expect = (r, status, extra = {}) => {
    if (r.status !== status) throw fail(`expected ${status}, got ${r.status}`, { body: r.body, ...extra })
    return r.body
  }

  /** Service-role verification reads (never sent to the API). */
  async function countFor(table, userId, column = 'user_id') {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, userId)
    if (error) throw fail(`service-role count on ${table} failed`, { code: error.code, message: error.message })
    return count
  }
  async function countAll(table) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) return null
    return count
  }
  async function fingerprint(table) {
    const { data, error } = await admin.from(table).select('*')
    if (error) return `error:${error.code}`
    return createHash('sha256').update(JSON.stringify(data)).digest('hex')
  }

  const unrelated = {} // per-table counts of rows NOT owned by A/B, before we write anything
  const legacyBefore = { count: await countAll(LEGACY_TABLE), hash: await fingerprint(LEGACY_TABLE) }
  for (const t of TABLES) unrelated[t] = await countAll(t)
  note('baseline captured', { legacyRows: legacyBefore.count, unrelated })

  try {
    // ---- C1, C2: temporary users ----------------------------------------------
    for (const who of ['A', 'B']) {
      await check(who === 'A' ? 1 : 2, async () => {
        const email = `lunelle-e2e-${RUN_ID}-${who.toLowerCase()}@example.com`
        const password = guard(randomBytes(18).toString('base64url'))
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { lunelle_e2e: RUN_ID } })
        if (error) throw fail('admin.createUser failed', { message: error.message, status: error.status })
        users[who] = { id: data.user.id, email, password, jwt: null }
        return `created ${email} (id ${data.user.id})`
      })
    }
    if (!users.A || !users.B) {
      block(CRITERIA.map(([id]) => id), 'user creation failed')
      return
    }

    // ---- C3: JWTs -----------------------------------------------------------------
    await check(3, async () => {
      for (const who of ['A', 'B']) {
        const { data, error } = await anon.auth.signInWithPassword({ email: users[who].email, password: users[who].password })
        if (error || !data.session?.access_token) throw fail(`signIn failed for ${who}`, { message: error?.message })
        users[who].jwt = guard(data.session.access_token)
        if (data.user.id !== users[who].id) throw fail('signed-in user id mismatch')
      }
      return 'access tokens obtained for A and B (not printed)'
    })
    if (!users.A.jwt || !users.B.jwt) {
      block(CRITERIA.map(([id]) => id), 'sign-in failed')
      return
    }

    // ---- C18–C21: signup bootstrap rows --------------------------------------------
    for (const [id, who, table, column] of [[18, 'A', 'profiles', 'id'], [19, 'A', 'subscription_state', 'user_id'], [20, 'B', 'profiles', 'id'], [21, 'B', 'subscription_state', 'user_id']]) {
      await check(id, async () => {
        const n = await countFor(table, users[who].id, column)
        if (n !== 1) throw fail(`expected 1 ${table} row for ${who}, found ${n}`)
        if (table === 'subscription_state') {
          const { data } = await admin.from(table).select('is_plus, source').eq(column, users[who].id).single()
          if (data?.is_plus !== false || data?.source !== 'revenuecat') throw fail('subscription defaults wrong', data)
        }
        return `${table} row present for ${who}`
      })
    }

    // ---- C4: boot the real backend -------------------------------------------------
    await check(4, async () => {
      const port = await freePort()
      backend = await bootBackend(port, childEnv)
      base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/api/health`).then((r) => r.json())
      if (health?.data?.status !== 'ok') throw fail('health check failed', health)
      return `backend listening on ${port}, health ok`
    })
    if (!base) {
      block(CRITERIA.map(([id]) => id), 'backend did not start')
      return
    }

    // ---- C5, C6: authenticated requests succeed ---------------------------------------
    await check(5, async () => {
      const body = expect(await api('A', 'GET', '/api/subscription'), 200)
      if (body.data?.isPlus !== false) throw fail('unexpected subscription', body)
      return 'GET /api/subscription → 200 for A'
    })
    await check(6, async () => {
      expect(await api('B', 'GET', '/api/subscription'), 200)
      return 'GET /api/subscription → 200 for B'
    })

    // ---- C14, C15: 401s ------------------------------------------------------------------
    await check(14, async () => {
      for (const [m, p] of [['GET', '/api/cycle-settings'], ['GET', `/api/today?date=${TODAY}`], ['GET', '/api/you'], ['DELETE', '/api/account']]) {
        const r = await api(null, m, p)
        if (r.status !== 401 || r.body?.code !== 'missing_authorization') throw fail(`${m} ${p} without token`, r)
      }
      return '4 routes → 401 missing_authorization'
    })
    await check(15, async () => {
      for (const [m, p] of [['GET', '/api/cycle-settings'], ['GET', '/api/you'], ['DELETE', '/api/account']]) {
        const r = await api('INVALID', m, p)
        if (r.status !== 401 || r.body?.code !== 'invalid_token') throw fail(`${m} ${p} with invalid token`, r)
      }
      return '3 routes → 401 invalid_token'
    })

    // ---- C7: A creates data (history: starts at -104, -76, -48, -20 → 3 completed 28-day cycles) --
    const A = { starts: [day(-104), day(-76), day(-48)], settingsStart: day(-20), eventIds: [], obsDates: [] }
    await check(7, async () => {
      const settings = expect(await api('A', 'PUT', '/api/cycle-settings', { reportedCycleLength: 28, reportedPeriodLength: 5, lastPeriodStart: A.settingsStart }), 200)
      if (settings.data?.lastPeriodStart !== A.settingsStart) throw fail('settings not echoed', settings)
      for (const d of A.starts) {
        const ev = expect(await api('A', 'POST', '/api/cycle-events', { type: 'period_start', date: d }), 201)
        A.eventIds.push(ev.data.id)
      }
      const end = expect(await api('A', 'POST', '/api/cycle-events', { type: 'period_end', date: day(-16) }), 201)
      A.eventIds.push(end.data.id)
      // Observations: per completed cycle, five energy-only days + cramps on day 21 (luteal) → assessable, phase-concentrated.
      for (const start of A.starts) {
        for (const off of [1, 3, 5, 8, 11]) {
          const d = day(-104 + A.starts.indexOf(start) * 28 + off)
          expect(await api('A', 'PUT', `/api/observations/${d}`, { energy: 3 }), 200)
          A.obsDates.push(d)
        }
        const d21 = day(-104 + A.starts.indexOf(start) * 28 + 20)
        expect(await api('A', 'PUT', `/api/observations/${d21}`, { mood: 2, symptoms: ['cramps'], note: `e2e ${RUN_ID}` }), 200)
        A.obsDates.push(d21)
      }
      const today = expect(await api('A', 'PUT', `/api/observations/${TODAY}`, { mood: 4, symptoms: ['fatigue'] }), 200)
      if (today.data?.date !== TODAY || today.data?.mood !== 4) throw fail('today observation not echoed', today)
      A.obsDates.push(TODAY)
      const dup = await api('A', 'POST', '/api/cycle-events', { type: 'period_start', date: A.starts[0] })
      if (dup.status !== 409 || dup.body?.code !== 'conflict') throw fail('duplicate event should be 409 conflict', dup)
      return `settings + ${A.eventIds.length} events (+1 synced start) + ${A.obsDates.length} observations; duplicate → 409`
    })

    // ---- C8: B creates data ----------------------------------------------------------------
    const B = { eventId: null, obsDate: day(-1) }
    await check(8, async () => {
      expect(await api('B', 'PUT', '/api/cycle-settings', { reportedCycleLength: 30, lastPeriodStart: day(-10) }), 200)
      const ev = expect(await api('B', 'POST', '/api/cycle-events', { type: 'period_start', date: day(-40) }), 201)
      B.eventId = ev.data.id
      expect(await api('B', 'PUT', `/api/observations/${B.obsDate}`, { mood: 5, note: `B ${RUN_ID}` }), 200)
      return 'settings + event + observation created for B'
    })

    // ---- C9, C10: each reads only their own ----------------------------------------------------
    await check(9, async () => {
      const events = expect(await api('A', 'GET', '/api/cycle-events'), 200).data
      const dates = events.map((e) => e.date)
      const expected = [...A.starts, A.settingsStart, day(-16)].sort()
      if (JSON.stringify(dates) !== JSON.stringify(expected)) throw fail('A event list mismatch', { dates, expected })
      if (events.some((e) => e.id === B.eventId)) throw fail("B's event visible to A")
      const obs = expect(await api('A', 'GET', '/api/observations?from=' + day(-120)), 200).data
      if (obs.some((o) => o.note?.startsWith('B '))) throw fail("B's observation visible to A")
      if (obs.length !== A.obsDates.length) throw fail('A observation count mismatch', { got: obs.length, expected: A.obsDates.length })
      const settings = expect(await api('A', 'GET', '/api/cycle-settings'), 200).data
      if (settings.reportedCycleLength !== 28) throw fail('A settings mismatch', settings)
      return `A sees ${events.length} events, ${obs.length} observations, own settings`
    })
    await check(10, async () => {
      const events = expect(await api('B', 'GET', '/api/cycle-events'), 200).data
      if (events.length !== 2 || !events.every((e) => [day(-40), day(-10)].includes(e.date))) throw fail('B event list mismatch', events)
      const obs = expect(await api('B', 'GET', '/api/observations?from=' + day(-120)), 200).data
      if (obs.length !== 1 || obs[0].date !== B.obsDate) throw fail('B observation list mismatch', obs)
      const settings = expect(await api('B', 'GET', '/api/cycle-settings'), 200).data
      if (settings.reportedCycleLength !== 30) throw fail('B settings mismatch', settings)
      return `B sees ${events.length} events, 1 observation, own settings`
    })

    // ---- C11, C12: cross-user access by ID ------------------------------------------------------
    await check(11, async () => {
      const del = await api('A', 'DELETE', `/api/cycle-events/${B.eventId}`)
      if (del.status !== 404 || del.body?.code !== 'not_found') throw fail("A deleting B's event should be 404", del)
      const still = expect(await api('B', 'GET', '/api/cycle-events'), 200).data
      if (!still.some((e) => e.id === B.eventId)) throw fail("B's event was removed by A")
      const n = await countFor('cycle_events', users.B.id)
      if (n !== 2) throw fail('B event count changed', { n })
      return "A → DELETE B's event id → 404; B's row intact"
    })
    await check(12, async () => {
      for (const id of A.eventIds.slice(0, 2)) {
        const del = await api('B', 'DELETE', `/api/cycle-events/${id}`)
        if (del.status !== 404) throw fail("B deleting A's event should be 404", del)
      }
      const n = await countFor('cycle_events', users.A.id)
      if (n !== A.eventIds.length + 1) throw fail('A event count changed', { n })
      return "B → DELETE A's event ids → 404; A's rows intact"
    })

    // ---- C13: ownership reassignment attempts ---------------------------------------------------
    await check(13, async () => {
      const attempts = [
        ['PUT', '/api/cycle-settings', { reportedCycleLength: 28, user_id: users.B.id }],
        ['PUT', '/api/cycle-settings', { reportedCycleLength: 28, userId: users.B.id }],
        ['POST', '/api/cycle-events', { type: 'period_end', date: day(-2), user_id: users.B.id }],
        ['PUT', `/api/observations/${day(-3)}`, { mood: 3, user_id: users.B.id }],
        ['DELETE', '/api/account', { userId: users.B.id }],
        ['GET', `/api/today?date=${TODAY}&user_id=${users.B.id}`, undefined],
        ['GET', `/api/you?user_id=${users.B.id}`, undefined],
      ]
      for (const [m, p, body] of attempts) {
        const r = await api('A', m, p, body)
        if (r.status !== 400 || r.body?.code !== 'validation_error') throw fail(`${m} ${p} with identity field should be 400`, r)
      }
      for (const t of ['cycle_settings', 'cycle_events', 'daily_observations']) {
        const n = await countFor(t, users.B.id)
        if (n !== { cycle_settings: 1, cycle_events: 2, daily_observations: 1 }[t]) throw fail(`B's ${t} changed`, { n })
      }
      const { data: bUser } = await admin.auth.admin.getUserById(users.B.id)
      if (!bUser?.user) throw fail('B was affected by the account-deletion attempt')
      return `${attempts.length} identity-carrying requests → 400 validation_error; B untouched`
    })

    // ---- C16: /api/today --------------------------------------------------------------------------
    await check(16, async () => {
      const t = expect(await api('A', 'GET', `/api/today?date=${TODAY}`), 200).data
      if (t.hasCycleSettings !== true) throw fail('hasCycleSettings', t)
      if (t.position?.cycleDay !== 21 || t.position.isEstimated !== false) throw fail('position unexpected', t.position)
      if (!t.nextPeriod || t.forecastBasis !== 'observed_cycle') throw fail('forecast unexpected', { nextPeriod: t.nextPeriod, basis: t.forecastBasis })
      if (t.nextPeriod.expectedStart !== day(8)) throw fail('expected start unexpected', t.nextPeriod)
      if (t.todayObservation?.mood !== 4 || t.loggedDays.total !== A.obsDates.length) throw fail('loggedDays/today unexpected', { logged: t.loggedDays, today: t.todayObservation })
      const snapshots = await countFor('forecasts', users.A.id)
      if (snapshots !== 1) throw fail(`expected 1 persisted forecast snapshot, found ${snapshots}`)
      expect(await api('A', 'GET', `/api/today?date=${TODAY}`), 200)
      if ((await countFor('forecasts', users.A.id)) !== 1) throw fail('identical re-read appended a snapshot')
      return `cycleDay 21, next period ${t.nextPeriod.expectedStart} (${t.nextPeriod.confidence}), basis observed_cycle, 1 snapshot persisted (no duplicate on re-read)`
    })

    // ---- C17: /api/you ------------------------------------------------------------------------------
    await check(17, async () => {
      const y = expect(await api('A', 'GET', '/api/you'), 200).data
      if (y.stats?.lengthSource !== 'history' || y.stats.sampleSize !== 3) throw fail('stats unexpected', y.stats)
      if (y.cycles?.length !== 4 || y.cycles[0].isCurrent !== true || y.cycles[0].periodLength !== 5) throw fail('cycles unexpected', y.cycles)
      const cramps = y.patterns?.find((p) => p.target.kind === 'symptom' && p.target.key === 'cramps')
      if (!cramps || cramps.tier === 'none' || cramps.dominantPhase !== 'luteal') throw fail('cramps pattern unexpected', y.patterns)
      const persisted = await countFor('pattern_evidence', users.A.id)
      if (persisted < 1) throw fail('no pattern_evidence persisted')
      const { data: row } = await admin.from('pattern_evidence').select('confidence_tier, computed_at').eq('user_id', users.A.id).eq('signal', 'cramps').single()
      expect(await api('A', 'GET', '/api/you'), 200)
      const { data: again } = await admin.from('pattern_evidence').select('computed_at').eq('user_id', users.A.id).eq('signal', 'cramps').single()
      if (again.computed_at !== row.computed_at) throw fail('unchanged evidence was rewritten on re-read')
      return `stats history/3, 4 cycles, cramps ${cramps.tier} (luteal), ${persisted} evidence rows persisted, stable on re-read`
    })

    // ---- C22–C29: delete A and verify cascades ----------------------------------------------------
    const beforeDelete = {}
    for (const t of TABLES) beforeDelete[t] = await countFor(t, users.A.id, t === 'profiles' ? 'id' : 'user_id')
    note('A row counts before deletion', beforeDelete)
    await check(22, async () => {
      const r = await api('A', 'DELETE', '/api/account')
      if (r.status !== 204) throw fail('DELETE /api/account', r)
      const { data, error } = await admin.auth.admin.getUserById(users.A.id)
      if (data?.user && !error) throw fail('A still exists in auth.users')
      const after = await api('A', 'GET', '/api/subscription')
      if (after.status !== 401) throw fail("A's token still accepted after deletion", after)
      return `204; auth user gone; A's token now → ${after.status}`
    })
    for (const [id, table] of [[23, 'profiles'], [24, 'cycle_settings'], [25, 'cycle_events'], [26, 'daily_observations'], [27, 'forecasts'], [28, 'pattern_evidence'], [29, 'subscription_state']]) {
      await check(id, async () => {
        const n = await countFor(table, users.A.id, table === 'profiles' ? 'id' : 'user_id')
        if (n !== 0) throw fail(`${table} still has ${n} rows for A`)
        if (beforeDelete[table] === 0 && table !== 'journal_entries') throw fail(`${table} had no A rows before deletion — cascade not exercised`)
        return `${beforeDelete[table]} → 0 rows`
      })
    }

    // ---- C30: B intact ------------------------------------------------------------------------------
    await check(30, async () => {
      const { data } = await admin.auth.admin.getUserById(users.B.id)
      if (!data?.user) throw fail('B auth user missing')
      const counts = {}
      for (const t of ['profiles', 'cycle_settings', 'cycle_events', 'daily_observations', 'subscription_state']) counts[t] = await countFor(t, users.B.id, t === 'profiles' ? 'id' : 'user_id')
      if (JSON.stringify(counts) !== JSON.stringify({ profiles: 1, cycle_settings: 1, cycle_events: 2, daily_observations: 1, subscription_state: 1 })) throw fail('B rows changed', counts)
      const events = expect(await api('B', 'GET', '/api/cycle-events'), 200).data
      if (events.length !== 2) throw fail('B API view changed', events)
      return 'B auth user + rows intact; B API still 200'
    })
  } finally {
    // ---- cleanup: only what this run created --------------------------------------------------------
    if (backend?.child) {
      backend.child.kill('SIGTERM')
      await new Promise((resolve) => backend.child.once('exit', resolve))
    }
    const cleanupEvidence = []
    for (const who of ['A', 'B']) {
      const u = users[who]
      if (!u) continue
      const { data } = await admin.auth.admin.getUserById(u.id)
      if (data?.user) {
        if (data.user.user_metadata?.lunelle_e2e !== RUN_ID) {
          cleanupEvidence.push(`${who}: refused to delete — not tagged with this run`)
          continue
        }
        const { error } = await admin.auth.admin.deleteUser(u.id)
        cleanupEvidence.push(`${who}: deleted (${error ? 'ERROR ' + error.message : 'ok'})`)
      } else {
        cleanupEvidence.push(`${who}: already gone`)
      }
    }
    // Verify cascades for B and that nothing else moved.
    let leftovers = 0
    for (const t of TABLES) {
      for (const u of [users.A, users.B].filter(Boolean)) leftovers += (await countFor(t, u.id, t === 'profiles' ? 'id' : 'user_id').catch(() => 0)) ?? 0
    }
    const unrelatedAfter = {}
    for (const t of TABLES) unrelatedAfter[t] = await countAll(t)
    const legacyAfter = { count: await countAll(LEGACY_TABLE), hash: await fingerprint(LEGACY_TABLE) }

    await check(33, async () => {
      if (leftovers !== 0) throw fail(`${leftovers} rows left for temporary users`, cleanupEvidence)
      return cleanupEvidence.join('; ')
    })
    await check(34, async () => {
      if (JSON.stringify(unrelatedAfter) !== JSON.stringify(unrelated)) throw fail('unrelated row counts changed', { before: unrelated, after: unrelatedAfter })
      return `unrelated row counts unchanged: ${JSON.stringify(unrelatedAfter)}`
    })
    await check(31, async () => {
      if (legacyBefore.count === null) return 'public.journals not exposed/present — nothing to modify'
      if (legacyAfter.count !== legacyBefore.count || legacyAfter.hash !== legacyBefore.hash) throw fail('legacy journals changed', { before: legacyBefore.count, after: legacyAfter.count })
      return `${legacyBefore.count} row(s), content fingerprint unchanged`
    })
    await check(32, async () => {
      if (bearersUsed.has(serviceKey) || bearersUsed.has(anonKey)) throw fail('a key was sent as a bearer')
      const allowed = [users.A?.jwt, users.B?.jwt, 'invalid.token.value'].filter(Boolean) // the last is C15's deliberately invalid bearer
      for (const b of bearersUsed) if (!allowed.includes(b)) throw fail('an unexpected bearer was used')
      return `${bearersUsed.size} distinct bearers used: A's JWT, B's JWT, and the deliberately invalid token`
    })

    // ---- report ---------------------------------------------------------------------------------------
    const lines = CRITERIA.map(([id, title]) => {
      const r = results.get(id)
      return `C${String(id).padStart(2, '0')} ${r.status.padEnd(7)} ${title}${r.evidence && r.status !== 'PASS' ? `\n        evidence: ${r.evidence}` : r.evidence && r.evidence !== 'ok' ? `\n        ${r.evidence}` : ''}`
    })
    results.set(36, { status: 'PASS', evidence: 'this report' })
    const anyFail = [...results.values()].some((r) => r.status === 'FAIL')
    const evidencePath = join(tmpdir(), `lunelle-cloud-e2e-${RUN_ID}.json`)
    writeFileSync(evidencePath, redact(JSON.stringify({ runId: RUN_ID, today: TODAY, results: Object.fromEntries(results), log: evidenceLog }, null, 2)))
    results.set(37, { status: 'PASS', evidence: `non-secret evidence written to ${evidencePath}` })
    results.set(35, { status: redactions === 0 ? 'PASS' : 'FAIL', evidence: `${redactions} redaction(s) were needed in printed output` })
    lines[35] = `C36 PASS    ${CRITERIA[35][1]}`
    lines[36] = `C37 PASS    ${CRITERIA[36][1]}\n        ${results.get(37).evidence}`
    lines[34] = `C35 ${results.get(35).status.padEnd(7)} ${CRITERIA[34][1]}\n        ${results.get(35).evidence}`
    const report = redact(`\n=== Lunelle V2 cloud E2E — run ${RUN_ID} (today ${TODAY}) ===\n${lines.join('\n')}\n=== ${[...results.values()].filter((r) => r.status === 'PASS').length} PASS / ${[...results.values()].filter((r) => r.status === 'FAIL').length} FAIL / ${[...results.values()].filter((r) => r.status === 'BLOCKED').length} BLOCKED ===\n`)
    console.log(report)
    assert.ok(!anyFail && redactions === 0, 'see report above')
  }
})
