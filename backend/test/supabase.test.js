import { test } from 'node:test'
import assert from 'node:assert/strict'

// Fake environment for this process only; env.js reads it lazily on first use.
Object.assign(process.env, {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  REVENUECAT_WEBHOOK_SECRET: 'test-rc-secret',
  AI_API_KEY: 'test-ai-key',
})

const { createUserClient, createServiceClient } = await import('../src/lib/supabase.js')

test('createUserClient uses the anon key and forwards the caller token', () => {
  const client = createUserClient('caller-jwt')
  assert.equal(client.supabaseKey, 'test-anon-key')
  assert.equal(client.headers.Authorization, 'Bearer caller-jwt')
  assert.equal(client.supabaseUrl, 'https://example.supabase.co')
})

test('createUserClient refuses an empty token', () => {
  assert.throws(() => createUserClient(''), TypeError)
  assert.throws(() => createUserClient(undefined), TypeError)
})

test('createServiceClient uses the service-role key and carries no user token', () => {
  const client = createServiceClient()
  assert.equal(client.supabaseKey, 'test-service-role-key')
  assert.equal(client.headers.Authorization, undefined)
})
