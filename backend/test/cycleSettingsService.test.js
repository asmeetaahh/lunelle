import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCycleSettingsService } from '../src/services/cycleSettingsService.js'

const TS = '2026-09-13T14:00:00+00:00'
const DB = { scoped: true } // opaque caller-scoped client; the service only passes it through

const settingsRow = (over = {}) => ({ id: 'cs-1', reportedCycleLength: 28, reportedPeriodLength: null, lastPeriodStart: null, createdAt: TS, updatedAt: TS, ...over })
const eventRow = (date) => ({ id: `e-${date}`, type: 'period_start', date, createdAt: TS })

/** Fake repos that record calls and answer from queues. */
function fakes({ settings = settingsRow(), existing = [], insert = () => eventRow('2026-08-14') } = {}) {
  const calls = []
  return {
    calls,
    cycleSettings: {
      get: async (db) => (calls.push(['settings.get', db]), settings),
      upsert: async (db, input) => (calls.push(['settings.upsert', db, input]), { ...settings, ...input }),
    },
    cycleEvents: {
      list: async (db, range) => (calls.push(['events.list', db, range]), existing),
      insert: async (db, input) => {
        calls.push(['events.insert', db, input])
        return insert(input)
      },
    },
  }
}

test('get: passes the scoped client straight through', async () => {
  const f = fakes()
  const service = createCycleSettingsService(f)
  assert.deepEqual(await service.get(DB), settingsRow())
  assert.deepEqual(f.calls, [['settings.get', DB]])
})

test('upsert without lastPeriodStart: settings only, no event traffic', async () => {
  const f = fakes()
  const service = createCycleSettingsService(f)
  const result = await service.upsert(DB, { reportedCycleLength: 30 })
  assert.deepEqual(result, { settings: settingsRow({ reportedCycleLength: 30 }), periodStartEvent: null, eventCreated: false })
  assert.deepEqual(f.calls, [['settings.upsert', DB, { reportedCycleLength: 30 }]])
})

test('upsert with lastPeriodStart: writes settings, then creates the missing period_start event', async () => {
  const f = fakes({ existing: [] })
  const service = createCycleSettingsService(f)
  const input = { reportedCycleLength: 28, lastPeriodStart: '2026-08-14' }
  const result = await service.upsert(DB, input)
  assert.deepEqual(f.calls, [
    ['settings.upsert', DB, input],
    ['events.list', DB, { from: '2026-08-14', to: '2026-08-14', type: 'period_start' }],
    ['events.insert', DB, { type: 'period_start', date: '2026-08-14' }],
  ])
  assert.equal(result.eventCreated, true)
  assert.deepEqual(result.periodStartEvent, eventRow('2026-08-14'))
  assert.equal(result.settings.lastPeriodStart, '2026-08-14')
})

test('upsert is idempotent: a repeated onboarding submission does not insert a second event', async () => {
  const f = fakes({ existing: [eventRow('2026-08-14')] })
  const service = createCycleSettingsService(f)
  const input = { reportedCycleLength: 28, lastPeriodStart: '2026-08-14' }
  const first = await service.upsert(DB, input)
  const second = await service.upsert(DB, input)
  assert.equal(first.eventCreated, false)
  assert.equal(second.eventCreated, false)
  assert.deepEqual(first.periodStartEvent, eventRow('2026-08-14'))
  assert.ok(!f.calls.some(([name]) => name === 'events.insert'), 'no insert when the event already exists')
  assert.equal(f.calls.filter(([name]) => name === 'settings.upsert').length, 2, 'settings are still (re)written each time')
})

test('upsert absorbs a racing duplicate (23505) instead of surfacing 409', async () => {
  let listCalls = 0
  const f = fakes({
    existing: [],
    insert: () => {
      throw { code: '23505', message: 'duplicate key value violates unique constraint "cycle_events_unique_per_day"' }
    },
  })
  // First list → nothing; after the race, list → the event another writer created.
  f.cycleEvents.list = async (db, range) => {
    f.calls.push(['events.list', db, range])
    listCalls += 1
    return listCalls === 1 ? [] : [eventRow('2026-08-14')]
  }
  const service = createCycleSettingsService(f)
  const result = await service.upsert(DB, { lastPeriodStart: '2026-08-14' })
  assert.equal(result.eventCreated, false)
  assert.deepEqual(result.periodStartEvent, eventRow('2026-08-14'))
  assert.deepEqual(f.calls.map(([n]) => n), ['settings.upsert', 'events.list', 'events.insert', 'events.list'])
})

test('upsert propagates every other repository error unchanged', async () => {
  const pgError = { code: '23514', message: 'check constraint' }
  const f = fakes({
    existing: [],
    insert: () => {
      throw pgError
    },
  })
  const service = createCycleSettingsService(f)
  await assert.rejects(service.upsert(DB, { lastPeriodStart: '2026-08-14' }), (e) => e === pgError)

  const settingsError = { code: '42501', message: 'rls' }
  const g = fakes()
  g.cycleSettings.upsert = async () => {
    throw settingsError
  }
  await assert.rejects(createCycleSettingsService(g).upsert(DB, { reportedCycleLength: 28 }), (e) => e === settingsError)
  assert.ok(!g.calls.some(([n]) => n.startsWith('events.')), 'settings failure stops before any event work')
})

test('clearing lastPeriodStart (null) clears the setting only and never touches events', async () => {
  const f = fakes()
  const service = createCycleSettingsService(f)
  const result = await service.upsert(DB, { lastPeriodStart: null })
  assert.equal(result.settings.lastPeriodStart, null)
  assert.equal(result.periodStartEvent, null)
  assert.deepEqual(f.calls.map(([n]) => n), ['settings.upsert'])
})

test('service never touches identity or the service-role client', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('../src/services/cycleSettingsService.js', import.meta.url), 'utf8')
  for (const forbidden of ['createServiceClient', 'SERVICE_ROLE', 'lib/supabase', 'user_id', 'userId', 'req.', 'res.', 'Date.now', 'new Date']) {
    assert.ok(!source.includes(forbidden), `contains "${forbidden}"`)
  }
})
