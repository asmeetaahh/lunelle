import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../src/config/env.js'
import { API_ROUTES } from '../../shared/api.ts'

// Importing the bootstrap must not read config or open a socket. No env is set here.
const server = await import('../src/server.js')
const { createServer, startServer, createShutdown, main, DEFAULT_TRUST_PROXY } = server

const SECRETS = {
  SUPABASE_ANON_KEY: 'anon-key-do-not-print-3f9a',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-do-not-print-7c2e',
  REVENUECAT_WEBHOOK_SECRET: 'rc-secret-do-not-print-9b1d',
  AI_API_KEY: 'ai-key-do-not-print-5e4f',
}
// PORT=0 (ephemeral) is rightly rejected by env.js for production; tests validate a real port then override it.
const fakeConfig = (port = 0) => ({ ...loadEnv({ PORT: '5001', SUPABASE_URL: 'https://example.supabase.co', ...SECRETS }), PORT: port })

/** A currently free TCP port on the loopback interface. */
async function freePort() {
  const s = http.createServer()
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve))
  const { port } = s.address()
  await new Promise((resolve) => s.close(resolve))
  return port
}

function captureLogger() {
  const lines = []
  return { lines, logger: { info: (l) => lines.push(String(l)), error: (l) => lines.push(String(l)) } }
}

const assertNoSecrets = (text) => {
  for (const value of Object.values(SECRETS)) assert.ok(!text.includes(value), `secret value leaked: ${value}`)
}

const fetchJson = async (port, path, init) => {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init)
  const text = await response.text()
  return { status: response.status, text, body: text ? JSON.parse(text) : undefined }
}

// ---------------------------------------------------------------------------
// Import-time behaviour and module shape
// ---------------------------------------------------------------------------

test('server module imports without config or a listener; exports only bootstrap helpers', () => {
  assert.equal(typeof createServer, 'function')
  assert.equal(typeof startServer, 'function')
  assert.equal(typeof createShutdown, 'function')
  assert.equal(typeof main, 'function')
  assert.equal(DEFAULT_TRUST_PROXY, 1)
})

test('server.js is bootstrap only: no V1 state, no static serving, no process.env, no secrets', async () => {
  const raw = await readFile(new URL('../src/server.js', import.meta.url), 'utf8')
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const forbidden of [
    'periods', 'moods', 'journalEntries', 'buildDashboard', 'responses', // V1 in-memory state and canned chat
    'express.static', 'sendFile', 'dist', "app.get('*'", // V1 SPA serving
    'process.env', 'dotenv', // config is env.js's job
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SERVICE_ROLE', 'AI_API_KEY', 'REVENUECAT', // never touched here
    'createServiceClient', 'supabase-js', 'engines/', 'repositories/', // no business wiring
    "app.set('trust proxy', true)",
  ]) {
    assert.ok(!code.includes(forbidden), `server.js contains "${forbidden}"`)
  }
  assert.equal((code.match(/\.listen\(/g) ?? []).length, 1, 'exactly one listen() call')
})

// ---------------------------------------------------------------------------
// createServer
// ---------------------------------------------------------------------------

test('createServer builds the V2 app with the given config, trust proxy 1, no listener', async () => {
  const { logger, lines } = captureLogger()
  const { app, config } = createServer({ config: fakeConfig(4321), logger })
  assert.equal(typeof app, 'function')
  assert.equal(config.PORT, 4321)
  assert.equal(app.get('trust proxy'), DEFAULT_TRUST_PROXY)
  assert.equal(createServer({ config: fakeConfig(), trustProxy: false }).app.get('trust proxy'), false)
  assert.deepEqual(lines, [])
})

test('the production app registers every V2 route and health; V1 routes are unreachable', async () => {
  const { app } = createServer({ config: fakeConfig(), logger: { error: () => {} } })
  const listener = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const port = listener.address().port
  try {
    const health = await fetchJson(port, API_ROUTES.health)
    assert.equal(health.status, 200)
    assert.equal(health.body.success, true)
    assert.equal(health.body.data.status, 'ok')

    // V2 authenticated routes exist: without a bearer they answer 401 from requireAuth, not 404.
    const v2 = [
      ['GET', API_ROUTES.cycleSettings], ['PUT', API_ROUTES.cycleSettings],
      ['GET', API_ROUTES.cycleEvents], ['POST', API_ROUTES.cycleEvents], ['DELETE', API_ROUTES.cycleEvent('22222222-2222-4222-8222-222222222222')],
      ['GET', API_ROUTES.observations], ['PUT', API_ROUTES.observation('2026-09-13')],
      ['GET', `${API_ROUTES.today}?date=2026-09-13`], ['GET', API_ROUTES.you],
      ['GET', API_ROUTES.subscription], ['DELETE', API_ROUTES.account],
    ]
    for (const [method, path] of v2) {
      const r = await fetchJson(port, path, { method })
      assert.equal(r.status, 401, `${method} ${path}`)
      assert.equal(r.body.code, 'missing_authorization')
    }

    // V1 endpoints and SPA serving are gone: every one is the V2 404 envelope.
    const v1 = [
      ['GET', '/api/dashboard'], ['GET', '/api/periods/prediction'], ['GET', '/api/periods'], ['POST', '/api/periods'],
      ['GET', '/api/moods'], ['POST', '/api/moods'], ['POST', '/api/chat'], ['GET', '/api/journal'], ['POST', '/api/journal'],
      ['GET', '/'], ['GET', '/index.html'], ['GET', '/anything'],
    ]
    for (const [method, path] of v1) {
      const r = await fetchJson(port, path, { method, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined })
      assert.equal(r.status, 404, `${method} ${path}`)
      assert.deepEqual(r.body, { success: false, code: 'not_found', message: 'Route not found' })
    }
  } finally {
    await new Promise((resolve) => listener.close(resolve))
  }
})

// ---------------------------------------------------------------------------
// startServer / shutdown
// ---------------------------------------------------------------------------

test('startServer listens on the configured port, logs no secrets, registers signal handlers, shuts down cleanly', async () => {
  const { logger, lines } = captureLogger()
  const proc = new EventEmitter()
  const exits = []
  const port = await freePort()
  const started = startServer({ config: fakeConfig(port), logger, proc, exit: (code) => exits.push(code) })
  try {
    await new Promise((resolve) => started.server.once('listening', resolve))
    assert.equal(started.server.address().port, port)
    const health = await fetchJson(port, '/api/health')
    assert.equal(health.status, 200)
    assert.equal(lines.length, 1)
    assert.equal(lines[0], `Lunelle backend listening on port ${port}`)
    assertNoSecrets(lines.join('\n'))
    assert.equal(proc.listenerCount('SIGTERM'), 1)
    assert.equal(proc.listenerCount('SIGINT'), 1)

    proc.emit('SIGTERM')
    await new Promise((resolve) => started.server.once('close', resolve))
    assert.deepEqual(exits, [0])
    assert.ok(lines.some((l) => l.includes('SIGTERM received')))
    assertNoSecrets(lines.join('\n'))
    assert.doesNotThrow(() => started.shutdown('SIGTERM'), 'second shutdown is a no-op')
    assert.deepEqual(exits, [0])
  } finally {
    if (started.server.listening) await new Promise((resolve) => started.server.close(resolve))
  }
})

test('createShutdown: forces exit when close does not complete in time, and never throws', async () => {
  const { logger, lines } = captureLogger()
  const exits = []
  const stuck = { close: () => {} } // never calls back
  const shutdown = createShutdown({ server: stuck, logger, exit: (c) => exits.push(c), timeoutMs: 20 })
  assert.doesNotThrow(() => shutdown('SIGINT'))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.deepEqual(exits, [1])
  assert.ok(lines.some((l) => l.includes('timed out')))
})

test('startServer reports a listen failure by error code only and exits 1', async () => {
  // Bind the wildcard address like app.listen(port) does, so the collision is real on every platform.
  const blocker = await new Promise((resolve) => {
    const s = http.createServer().listen(0, () => resolve(s))
  })
  try {
    const port = blocker.address().port
    const { logger, lines } = captureLogger()
    const exits = []
    const started = startServer({ config: fakeConfig(port), logger, proc: new EventEmitter(), exit: (c) => exits.push(c) })
    await new Promise((resolve) => started.server.once('error', () => setImmediate(resolve)))
    assert.deepEqual(exits, [1])
    assert.ok(lines.some((l) => l.includes('EADDRINUSE')))
    assertNoSecrets(lines.join('\n'))
  } finally {
    await new Promise((resolve) => blocker.close(resolve))
  }
})

// ---------------------------------------------------------------------------
// main(): configuration failures
// ---------------------------------------------------------------------------

test('main(): malformed configuration fails clearly, naming variables but never values; other failures exit 1 too', () => {
  const { logger, lines } = captureLogger()
  const exits = []
  const bad = () => loadEnv({ SUPABASE_URL: 'not a url', SUPABASE_ANON_KEY: SECRETS.SUPABASE_ANON_KEY })
  const result = main({ logger, exit: (c) => exits.push(c), start: bad })
  assert.equal(result, null)
  assert.deepEqual(exits, [1])
  assert.equal(lines.length, 1)
  assert.ok(lines[0].includes('Invalid backend environment'))
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY: missing', 'REVENUECAT_WEBHOOK_SECRET: missing', 'AI_API_KEY: missing']) assert.ok(lines[0].includes(name), name)
  assertNoSecrets(lines.join('\n'))

  const other = captureLogger()
  const otherExits = []
  main({ logger: other.logger, exit: (c) => otherExits.push(c), start: () => { throw new Error('boom') } })
  assert.deepEqual(otherExits, [1])
  assert.ok(other.lines[0].includes('boom'))

  const ok = captureLogger()
  const started = main({ logger: ok.logger, exit: () => assert.fail('must not exit'), start: () => ({ fake: true }) })
  assert.deepEqual(started, { fake: true })
})

// ---------------------------------------------------------------------------
// Real process boot (node src/server.js) — no Supabase connection is made at boot
// ---------------------------------------------------------------------------

const serverPath = fileURLToPath(new URL('../src/server.js', import.meta.url))

/**
 * Boot the real entrypoint in a child process with exactly the given variables.
 * src/config/env.js imports `dotenv/config`, which would otherwise pull in a
 * developer's backend/.env; pointing DOTENV_CONFIG_PATH at a file that does not
 * exist makes dotenv a silent no-op in the child, so the test environment is
 * genuinely what `env` says — and real development keeps loading .env as before.
 */
const NO_DOTENV = { DOTENV_CONFIG_PATH: fileURLToPath(new URL('./__no_such_dotenv_file__', import.meta.url)) }

function runServer(env, { signalAfterListen } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serverPath], { env: { PATH: process.env.PATH, ...NO_DOTENV, ...env }, cwd: fileURLToPath(new URL('..', import.meta.url)) })
    let stdout = ''
    let stderr = ''
    let signalled = false
    child.stdout.on('data', (d) => {
      stdout += d
      // Signal exactly once: the bootstrap registers `once` handlers, so a second signal is a deliberate force-quit.
      if (signalAfterListen && !signalled && /listening on port \d+/.test(stdout)) {
        signalled = true
        child.kill(signalAfterListen)
      }
    })
    child.stderr.on('data', (d) => (stderr += d))
    const killer = setTimeout(() => child.kill('SIGKILL'), 8000)
    child.on('exit', (code, signal) => {
      clearTimeout(killer)
      resolve({ code, signal, stdout, stderr })
    })
  })
}

test('node src/server.js with an empty environment exits 1 with a clear, value-free message', async () => {
  const result = await runServer({})
  assert.equal(result.code, 1, `stdout: ${result.stdout}\nstderr: ${result.stderr}`)
  assert.ok(result.stderr.includes('Invalid backend environment'))
  for (const name of ['SUPABASE_URL: missing', 'SUPABASE_ANON_KEY: missing', 'SUPABASE_SERVICE_ROLE_KEY: missing', 'REVENUECAT_WEBHOOK_SECRET: missing', 'AI_API_KEY: missing']) {
    assert.ok(result.stderr.includes(name), name)
  }
  assert.ok(!result.stdout.includes('listening'))
})

test('node src/server.js with a valid environment boots, logs only the port, and exits 0 on SIGTERM', async () => {
  const port = await freePort()
  const result = await runServer({ PORT: String(port), SUPABASE_URL: 'https://example.supabase.co', ...SECRETS }, { signalAfterListen: 'SIGTERM' })
  assert.equal(result.code, 0, `stderr: ${result.stderr}`)
  assert.ok(result.stdout.includes(`listening on port ${port}`))
  assert.ok(result.stdout.includes('SIGTERM received'))
  assertNoSecrets(result.stdout + result.stderr)
  assert.ok(!result.stdout.includes('example.supabase.co'), 'not even the URL is printed')
})
