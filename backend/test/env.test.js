import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspect } from 'node:util'
import { loadEnv, EnvValidationError } from '../src/config/env.js'

const SECRET = 'do-not-print-me-7f3a'

const complete = {
  PORT: '5050',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: SECRET,
  REVENUECAT_WEBHOOK_SECRET: 'rc-secret',
  AI_API_KEY: 'ai-key',
}

test('loadEnv returns a frozen config with all variables', () => {
  const config = loadEnv(complete)
  assert.equal(config.PORT, 5050)
  assert.equal(config.SUPABASE_URL, complete.SUPABASE_URL)
  assert.equal(config.SUPABASE_SERVICE_ROLE_KEY, SECRET)
  assert.ok(Object.isFrozen(config))
  assert.throws(() => {
    config.PORT = 1
  }, TypeError)
})

test('PORT defaults to 5001 when absent', () => {
  const { PORT: _omit, ...rest } = complete
  assert.equal(loadEnv(rest).PORT, 5001)
})

test('missing variables fail clearly, naming every missing variable', () => {
  const { SUPABASE_URL: _a, AI_API_KEY: _b, ...partial } = complete
  assert.throws(
    () => loadEnv(partial),
    (error) =>
      error instanceof EnvValidationError &&
      error.problems.some((p) => p.startsWith('SUPABASE_URL:')) &&
      error.problems.some((p) => p.startsWith('AI_API_KEY:')) &&
      error.problems.length === 2,
  )
})

test('empty strings and bad URLs are rejected', () => {
  assert.throws(() => loadEnv({ ...complete, SUPABASE_ANON_KEY: '   ' }), EnvValidationError)
  assert.throws(() => loadEnv({ ...complete, SUPABASE_URL: 'not a url' }), EnvValidationError)
})

test('error messages never include secret values', () => {
  try {
    loadEnv({ ...complete, SUPABASE_URL: SECRET })
    assert.fail('expected to throw')
  } catch (error) {
    assert.ok(error instanceof EnvValidationError)
    assert.ok(!error.message.includes(SECRET))
    assert.ok(!JSON.stringify(error.problems).includes(SECRET))
  }
})

test('logging the config object redacts values', () => {
  const config = loadEnv(complete)
  assert.ok(!inspect(config).includes(SECRET))
  assert.ok(!JSON.stringify(config).includes(SECRET))
})
