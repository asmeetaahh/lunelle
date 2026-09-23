import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { createApp, corsOptions, RATE_LIMIT_DEFAULTS, JSON_BODY_LIMIT } from '../src/app.js'
import { ok, created, noContent, fail } from '../src/lib/respond.js'
import { validate } from '../src/middleware/validate.js'
import { ApiError, ERROR_CODES, STATUS_FOR_CODE, asyncHandler, redact, createErrorHandler } from '../src/middleware/errorHandler.js'
import * as shared from '../../shared/constants.ts'

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.c2lnbmF0dXJlLXNpZ25hdHVyZQ'
const SERVICE_KEY = 'sb_secret_9f8e7d6c5b4a3f2e1d0c'

/** Bind an app to an ephemeral port for the duration of `fn`. */
async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(base)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function captureLogger() {
  const lines = []
  return { lines, logger: { error: (...args) => lines.push(args.map(String).join(' ')) } }
}

/** App with a set of probe routes exercising every helper and error path. */
function probeApp(options = {}) {
  return createApp({
    ...options,
    routes: (app) => {
      app.get('/api/probe/ok', (req, res) => ok(res, { hello: 'world' }))
      app.post('/api/probe/created', (req, res) => created(res, { id: 'x' }))
      app.delete('/api/probe/gone', (req, res) => noContent(res))
      app.get('/api/probe/fail', (req, res) => fail(res, 401, 'invalid_token', 'nope'))
      app.get('/api/probe/api-error', () => {
        throw new ApiError('premium_required', 'Plus only', { feature: 'patterns' })
      })
      app.get('/api/probe/api-error-shape', (req, res, next) =>
        next({ name: 'ApiError', status: 409, code: 'conflict', message: 'shape only', details: undefined }),
      )
      app.get('/api/probe/async-error', asyncHandler(async () => {
        throw new ApiError('not_found')
      }))
      app.get('/api/probe/pg-23505', (req, res, next) =>
        next({
          code: '23505',
          message: 'duplicate key value violates unique constraint "cycle_events_unique_per_day"',
          details: 'Key (user_id, type, date)=(11111111-1111-1111-1111-111111111111, period_start, 2026-08-14) already exists.',
          hint: null,
        }),
      )
      app.get('/api/probe/pg-42501', (req, res, next) => next({ code: '42501', message: 'new row violates row-level security policy for table "journal_entries"' }))
      app.get('/api/probe/pg-23514', (req, res, next) => next({ code: '23514', message: 'new row for relation "daily_observations" violates check constraint "daily_observations_mood_scale"' }))
      app.get('/api/probe/pgrst116', (req, res, next) => next({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }))
      app.get('/api/probe/zod-thrown', () => {
        z.object({ mood: z.number().int().min(1).max(5) }).parse({ mood: 9 })
      })
      app.get('/api/probe/boom', () => {
        const err = new Error(`connect failed with Authorization: Bearer ${TOKEN} using SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY} for select * from daily_observations where note = 'felt awful, heavy cramps'`)
        err.code = 'ECONNREFUSED'
        throw err
      })
      app.post(
        '/api/probe/validate/:date',
        validate({
          params: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
          query: z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) }),
          body: z.object({ mood: z.number().int().min(1).max(5).nullable().optional(), symptoms: z.array(z.enum(shared.SYMPTOMS)).max(20).default([]) }).strict(),
        }),
        (req, res) => ok(res, { params: req.params, query: req.query, body: req.body, validated: req.validated }),
      )
    },
  })
}

const json = async (response) => ({ status: response.status, headers: response.headers, body: await response.json() })

// ---------------------------------------------------------------------------
// App shell + health
// ---------------------------------------------------------------------------

test('app initialises without listening and exposes limiters', () => {
  const app = createApp()
  assert.equal(typeof app, 'function')
  assert.equal(typeof app.locals.limiters.standard, 'function')
  assert.equal(typeof app.locals.limiters.strict, 'function')
  assert.equal(app.get('x-powered-by'), false)
})

test('GET /api/health is public, enveloped, and carries the V1 liveness fields', async () => {
  await withServer(createApp(), async (base) => {
    const { status, headers, body } = await json(await fetch(`${base}/api/health`))
    assert.equal(status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'ok')
    assert.equal(body.data.message, 'Lunelle backend is running')
    assert.match(body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(typeof body.data.uptimeSeconds, 'number')
    assert.equal(Object.keys(body).sort().join(','), 'data,success', 'no V1 spread fields at top level')
    // helmet
    assert.equal(headers.get('x-content-type-options'), 'nosniff')
    assert.equal(headers.get('x-powered-by'), null)
    assert.equal(headers.get('ratelimit'), null, 'health is not rate-limited')
  })
})

test('unknown routes return the not_found envelope', async () => {
  await withServer(createApp(), async (base) => {
    const { status, body } = await json(await fetch(`${base}/api/nope`))
    assert.equal(status, 404)
    assert.deepEqual(body, { success: false, code: 'not_found', message: 'Route not found' })
  })
})

// ---------------------------------------------------------------------------
// respond.js
// ---------------------------------------------------------------------------

test('respond helpers produce only the contract envelopes', async () => {
  await withServer(probeApp(), async (base) => {
    const okRes = await json(await fetch(`${base}/api/probe/ok`))
    assert.equal(okRes.status, 200)
    assert.deepEqual(okRes.body, { success: true, data: { hello: 'world' } })

    const createdRes = await json(await fetch(`${base}/api/probe/created`, { method: 'POST' }))
    assert.equal(createdRes.status, 201)
    assert.deepEqual(createdRes.body, { success: true, data: { id: 'x' } })

    const gone = await fetch(`${base}/api/probe/gone`, { method: 'DELETE' })
    assert.equal(gone.status, 204)
    assert.equal(await gone.text(), '')

    const failed = await json(await fetch(`${base}/api/probe/fail`))
    assert.equal(failed.status, 401)
    assert.deepEqual(failed.body, { success: false, code: 'invalid_token', message: 'nope' })
    assert.equal(failed.headers.get('www-authenticate'), 'Bearer')
  })
})

// ---------------------------------------------------------------------------
// validate.js
// ---------------------------------------------------------------------------

test('validate: body, query and params are parsed, coerced and replaced on success', async () => {
  await withServer(probeApp(), async (base) => {
    const { status, body } = await json(
      await fetch(`${base}/api/probe/validate/2026-09-13?limit=5`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mood: 4, symptoms: ['cramps'] }),
      }),
    )
    assert.equal(status, 200)
    assert.deepEqual(body.data.params, { date: '2026-09-13' })
    assert.deepEqual(body.data.query, { limit: 5 })
    assert.deepEqual(body.data.body, { mood: 4, symptoms: ['cramps'] })
    assert.deepEqual(body.data.validated, { params: { date: '2026-09-13' }, query: { limit: 5 }, body: { mood: 4, symptoms: ['cramps'] } })
  })
})

test('validate: defaults apply and failures across all three parts are reported together', async () => {
  await withServer(probeApp(), async (base) => {
    const defaults = await json(
      await fetch(`${base}/api/probe/validate/2026-09-13`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    )
    assert.equal(defaults.status, 200)
    assert.deepEqual(defaults.body.data.query, { limit: 10 })
    assert.deepEqual(defaults.body.data.body, { symptoms: [] })

    const { status, body } = await json(
      await fetch(`${base}/api/probe/validate/not-a-date?limit=999`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mood: 9, symptoms: ['unicorns'], extra: true }),
      }),
    )
    assert.equal(status, 400)
    assert.equal(body.success, false)
    assert.equal(body.code, 'validation_error')
    assert.equal(body.message, 'Request validation failed')
    const where = body.details.map((d) => `${d.in}:${d.path}`)
    assert.ok(where.includes('params:date'))
    assert.ok(where.includes('query:limit'))
    assert.ok(where.includes('body:mood'))
    assert.ok(where.some((w) => w.startsWith('body:symptoms')))
    assert.ok(where.some((w) => w === 'body:' || w === 'body:extra'), 'strict schema flags unknown key')
    for (const d of body.details) assert.deepEqual(Object.keys(d).sort(), ['in', 'message', 'path'])
    const text = JSON.stringify(body)
    assert.ok(!text.includes('unicorns'), 'raw input is not echoed')
    assert.ok(!/\bat\s.+\.js/.test(text), 'no stack trace')
  })
})

test('validate: malformed JSON and oversized bodies become validation_error', async () => {
  await withServer(probeApp(), async (base) => {
    const bad = await json(await fetch(`${base}/api/probe/validate/2026-09-13`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' }))
    assert.equal(bad.status, 400)
    assert.equal(bad.body.code, 'validation_error')
    assert.equal(bad.body.message, 'Request body is not valid JSON')

    assert.equal(JSON_BODY_LIMIT, '64kb')
    const huge = await json(
      await fetch(`${base}/api/probe/validate/2026-09-13`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mood: 3, symptoms: [], pad: 'x'.repeat(70 * 1024) }),
      }),
    )
    assert.equal(huge.status, 400)
    assert.equal(huge.body.code, 'validation_error')
    assert.equal(huge.body.message, 'Request body exceeds the size limit')
  })
})

test('validate: misuse is caught at construction time', () => {
  assert.throws(() => validate(), TypeError)
  assert.throws(() => validate({}), TypeError)
  assert.throws(() => validate({ body: {} }), TypeError)
})

// ---------------------------------------------------------------------------
// errorHandler.js
// ---------------------------------------------------------------------------

test('ApiError: codes and statuses are pinned to shared/constants.ts and the contract table', () => {
  assert.deepEqual([...ERROR_CODES], [...shared.API_ERROR_CODES])
  assert.deepEqual(Object.keys(STATUS_FOR_CODE).sort(), [...ERROR_CODES].sort())
  assert.throws(() => new ApiError('forbidden'), TypeError)
  const e = new ApiError('conflict')
  assert.equal(e.status, 409)
  assert.equal(e.message, 'Resource already exists')
  assert.ok(e instanceof Error)
})

test('errorHandler: ApiError (class or shape) preserves status, code and details; async errors reach it', async () => {
  await withServer(probeApp(), async (base) => {
    const classy = await json(await fetch(`${base}/api/probe/api-error`))
    assert.equal(classy.status, 403)
    assert.deepEqual(classy.body, { success: false, code: 'premium_required', message: 'Plus only', details: { feature: 'patterns' } })

    const shaped = await json(await fetch(`${base}/api/probe/api-error-shape`))
    assert.equal(shaped.status, 409)
    assert.deepEqual(shaped.body, { success: false, code: 'conflict', message: 'shape only' })

    const asyncErr = await json(await fetch(`${base}/api/probe/async-error`))
    assert.equal(asyncErr.status, 404)
    assert.equal(asyncErr.body.code, 'not_found')
  })
})

test('errorHandler: Postgres/PostgREST codes map to stable codes without leaking database internals', async () => {
  await withServer(probeApp(), async (base) => {
    const conflict = await json(await fetch(`${base}/api/probe/pg-23505`))
    assert.equal(conflict.status, 409)
    assert.deepEqual(conflict.body, { success: false, code: 'conflict', message: 'Resource already exists' })

    const rls = await json(await fetch(`${base}/api/probe/pg-42501`))
    assert.equal(rls.status, 404)
    assert.equal(rls.body.code, 'not_found')

    const check = await json(await fetch(`${base}/api/probe/pg-23514`))
    assert.equal(check.status, 400)
    assert.equal(check.body.code, 'validation_error')

    const single = await json(await fetch(`${base}/api/probe/pgrst116`))
    assert.equal(single.status, 404)

    for (const r of [conflict, rls, check, single]) {
      const text = JSON.stringify(r.body)
      for (const leak of ['duplicate key', 'cycle_events', 'Key (', 'row-level', 'journal_entries', 'daily_observations', 'constraint', 'JSON object']) {
        assert.ok(!text.includes(leak), `leaked "${leak}"`)
      }
    }
  })
})

test('errorHandler: thrown Zod errors become validation_error', async () => {
  await withServer(probeApp(), async (base) => {
    const { status, body } = await json(await fetch(`${base}/api/probe/zod-thrown`))
    assert.equal(status, 400)
    assert.equal(body.code, 'validation_error')
    assert.equal(body.details[0].path, 'mood')
  })
})

test('errorHandler: unknown errors → 500 internal with nothing leaked, and the log line is redacted', async () => {
  const { lines, logger } = captureLogger()
  await withServer(probeApp({ logger }), async (base) => {
    const response = await fetch(`${base}/api/probe/boom`)
    const text = await response.text()
    assert.equal(response.status, 500)
    assert.deepEqual(JSON.parse(text), { success: false, code: 'internal', message: 'Internal server error' })
    for (const leak of [TOKEN, SERVICE_KEY, 'ECONNREFUSED', 'select *', 'heavy cramps', 'at ', 'node_modules', '.js:']) {
      assert.ok(!text.includes(leak), `response leaked "${leak}"`)
    }
  })
  assert.equal(lines.length, 1, 'exactly one log line')
  const line = lines[0]
  assert.ok(line.includes('unhandled_error'))
  assert.ok(line.includes('ECONNREFUSED'), 'operational detail is logged')
  assert.ok(!line.includes(TOKEN), 'JWT redacted from log')
  assert.ok(!line.includes(SERVICE_KEY), 'service key redacted from log')
  assert.ok(line.includes('[redacted-jwt]') || line.includes('Bearer [redacted]'))
  assert.ok(line.includes('SUPABASE_SERVICE_ROLE_KEY=[redacted]'))
})

test('errorHandler: handled errors are not logged', async () => {
  const { lines, logger } = captureLogger()
  await withServer(probeApp({ logger }), async (base) => {
    await fetch(`${base}/api/probe/api-error`)
    await fetch(`${base}/api/probe/pg-23505`)
    await fetch(`${base}/api/probe/zod-thrown`)
    await fetch(`${base}/api/nope`)
  })
  assert.deepEqual(lines, [])
})

test('redact masks tokens, keys and secret assignments but keeps ordinary text', () => {
  const input = `Authorization: Bearer ${TOKEN}; token=${TOKEN}; key ${SERVICE_KEY}; AI_API_KEY=sk-abcdefghijklmnop; plain words 2026-09-13`
  const out = redact(input)
  assert.ok(!out.includes(TOKEN))
  assert.ok(!out.includes(SERVICE_KEY))
  assert.ok(!out.includes('sk-abcdefghijklmnop'))
  assert.ok(out.includes('plain words 2026-09-13'))
})

test('errorHandler: defers to Express when headers were already sent', () => {
  const handler = createErrorHandler({ logger: { error: () => assert.fail('should not log') } })
  let forwarded = null
  handler(new Error('late'), { method: 'GET', path: '/x' }, { headersSent: true }, (e) => (forwarded = e))
  assert.equal(forwarded.message, 'late')
})

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test('CORS: no Origin (native client) succeeds without CORS headers', async () => {
  await withServer(createApp({ corsOrigins: ['http://localhost:8081'] }), async (base) => {
    const response = await fetch(`${base}/api/health`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  })
})

test('CORS: allow-listed origin is echoed; others get no CORS headers; preflight works', async () => {
  await withServer(createApp({ corsOrigins: ['http://localhost:8081', ' https://app.lunelle.example '] }), async (base) => {
    const allowed = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:8081' } })
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081')
    assert.equal(allowed.headers.get('access-control-allow-credentials'), null)

    const trimmed = await fetch(`${base}/api/health`, { headers: { Origin: 'https://app.lunelle.example' } })
    assert.equal(trimmed.headers.get('access-control-allow-origin'), 'https://app.lunelle.example')

    const denied = await fetch(`${base}/api/health`, { headers: { Origin: 'http://localhost:5173' } })
    assert.equal(denied.status, 200, 'request still served; the browser enforces')
    assert.equal(denied.headers.get('access-control-allow-origin'), null)

    const preflight = await fetch(`${base}/api/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'Authorization, Content-Type' },
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:8081')
    assert.ok(preflight.headers.get('access-control-allow-methods').includes('PUT'))
    assert.ok(preflight.headers.get('access-control-allow-headers').includes('Authorization'))
  })
})

test('CORS: default allow-list is empty, and localhost:5173 is not assumed', () => {
  const opts = corsOptions()
  const results = []
  opts.origin(undefined, (err, allow) => results.push(allow))
  opts.origin('http://localhost:5173', (err, allow) => results.push(allow))
  assert.deepEqual(results, [true, false])
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test('rate limiter: /api routes are limited with the envelope, health is not; strict tier exists', async () => {
  const app = createApp({
    rateLimit: { standard: { limit: 2, windowMs: 60_000 }, strict: { limit: 1, windowMs: 60_000 } },
    routes: (a, { limiters }) => {
      a.get('/api/limited', (req, res) => ok(res, 1))
      a.get('/api/strict', limiters.strict, (req, res) => ok(res, 1))
    },
  })
  await withServer(app, async (base) => {
    for (let i = 0; i < 5; i += 1) assert.equal((await fetch(`${base}/api/health`)).status, 200, 'health never limited')

    const statuses = []
    for (let i = 0; i < 3; i += 1) statuses.push((await fetch(`${base}/api/limited`)).status)
    assert.deepEqual(statuses, [200, 200, 429])
    const limited = await json(await fetch(`${base}/api/limited`))
    assert.deepEqual(limited.body, { success: false, code: 'rate_limited', message: 'Too many requests, please try again later' })
    assert.ok(limited.headers.get('ratelimit'), 'standard draft-7 header present')

    const strict = [(await fetch(`${base}/api/strict`)).status, (await fetch(`${base}/api/strict`)).status]
    assert.ok(strict.includes(429), 'strict tier limits independently')
  })
  assert.equal(RATE_LIMIT_DEFAULTS.strict.limit < RATE_LIMIT_DEFAULTS.standard.limit, true)
})
