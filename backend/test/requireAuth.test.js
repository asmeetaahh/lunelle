import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequireAuth } from '../src/middleware/requireAuth.js'

const TOKEN = 'eyJ.fake-token.sig-9c1d'

function makeReq(headers = {}, body = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return { headers: lower, body, get: (name) => lower[name.toLowerCase()] }
}

function makeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined }
  res.set = (k, v) => ((res.headers[k] = v), res)
  res.status = (code) => ((res.statusCode = code), res)
  res.json = (payload) => ((res.body = payload), res)
  return res
}

/** Fake user-scoped client that records the token it was built with. */
function fakeClientFactory({ user = null, error = null, throws = false } = {}) {
  const calls = []
  const factory = (accessToken) => {
    calls.push(accessToken)
    return {
      auth: {
        getUser: async () => {
          if (throws) throw new Error('network down')
          return { data: { user }, error }
        },
      },
    }
  }
  return { factory, calls }
}

async function run(middleware, req) {
  const res = makeRes()
  let nextCalled = false
  await middleware(req, res, () => {
    nextCalled = true
  })
  return { res, nextCalled }
}

test('rejects a request with no Authorization header', async () => {
  const { factory, calls } = fakeClientFactory()
  const { res, nextCalled } = await run(createRequireAuth({ createUserClient: factory }), makeReq())
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.code, 'missing_authorization')
  assert.equal(res.body.success, false)
  assert.equal(res.headers['WWW-Authenticate'], 'Bearer')
  assert.equal(nextCalled, false)
  assert.equal(calls.length, 0, 'no client is built without a token')
})

test('rejects malformed Authorization headers before building a client', async () => {
  for (const value of ['Basic abc', 'Bearer', 'Bearer ', 'Bearer a b', 'Token xyz', TOKEN]) {
    const { factory, calls } = fakeClientFactory()
    const { res, nextCalled } = await run(
      createRequireAuth({ createUserClient: factory }),
      makeReq({ Authorization: value }),
    )
    assert.equal(res.statusCode, 401, `expected 401 for "${value}"`)
    assert.equal(res.body.code, 'malformed_authorization', `unexpected code for "${value}"`)
    assert.equal(nextCalled, false)
    assert.equal(calls.length, 0)
  }
})

test('rejects an invalid or expired token with 401 and does not echo the token', async () => {
  const { factory } = fakeClientFactory({ error: { message: `bad token ${TOKEN}` } })
  const { res, nextCalled } = await run(
    createRequireAuth({ createUserClient: factory }),
    makeReq({ Authorization: `Bearer ${TOKEN}` }),
  )
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.code, 'invalid_token')
  assert.equal(nextCalled, false)
  assert.ok(!JSON.stringify(res.body).includes(TOKEN))
})

test('returns 503 when the auth service cannot be reached', async () => {
  const { factory } = fakeClientFactory({ throws: true })
  const { res, nextCalled } = await run(
    createRequireAuth({ createUserClient: factory }),
    makeReq({ Authorization: `Bearer ${TOKEN}` }),
  )
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.code, 'auth_unavailable')
  assert.equal(nextCalled, false)
})

test('attaches the verified user and the user-scoped client on success', async () => {
  const user = { id: 'user-from-token', email: 'a@example.com' }
  const { factory, calls } = fakeClientFactory({ user })
  const req = makeReq({ authorization: `bearer ${TOKEN}` }, { user_id: 'attacker-supplied-id' })
  const { res, nextCalled } = await run(createRequireAuth({ createUserClient: factory }), req)

  assert.equal(nextCalled, true)
  assert.equal(res.body, undefined, 'no response written on success')
  assert.deepEqual(calls, [TOKEN], 'client built with exactly the bearer token, case-insensitive scheme')
  assert.equal(req.user.id, 'user-from-token', 'identity comes from the token, not the body')
  assert.equal(typeof req.supabase.auth.getUser, 'function')
})

test('requireAuth never references the service-role client or key', async () => {
  const source = await readFile(new URL('../src/middleware/requireAuth.js', import.meta.url), 'utf8')
  assert.ok(!source.includes('createServiceClient'))
  assert.ok(!source.includes('SERVICE_ROLE'))
  assert.ok(source.includes('createUserClient'))
})
