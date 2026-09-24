import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import * as cycleSettings from '../src/repositories/cycleSettings.js'
import * as cycleEvents from '../src/repositories/cycleEvents.js'
import * as observations from '../src/repositories/observations.js'
import * as forecasts from '../src/repositories/forecasts.js'
import * as patternEvidence from '../src/repositories/patternEvidence.js'
import * as subscription from '../src/repositories/subscription.js'
import * as journal from '../src/repositories/journal.js'
import * as m from '../src/lib/mappers.js'
import { createFakeSupabase, onlyCall, methodsOf, argsOf } from './helpers/fakeSupabase.js'

const USER = '11111111-1111-1111-1111-111111111111'
const TS = '2026-09-13T14:00:00+00:00'
const PG_ERROR = Object.freeze({ code: '23505', message: 'duplicate key value violates unique constraint "cycle_events_unique_per_day"', details: 'Key (user_id, type, date)=(…) already exists.', hint: null })

const noIdentity = (obj) => {
  assert.ok(!('user_id' in obj) && !('userId' in obj), 'no identity key in contract object')
  assert.ok(!JSON.stringify(obj).includes(USER), 'no user id value in contract object')
}

/** Every repository function must throw the identical PostgREST error object. */
async function assertPropagates(fn) {
  const { client } = createFakeSupabase([{ data: null, error: PG_ERROR }])
  await assert.rejects(fn(client), (e) => e === PG_ERROR)
}

// ---------------------------------------------------------------------------
// cycleSettings
// ---------------------------------------------------------------------------

test('cycleSettings.get: selects the contract columns with maybeSingle; null when no row', async () => {
  const row = { id: 'cs-1', user_id: USER, reported_cycle_length: 28, reported_period_length: null, last_period_start: null, created_at: TS, updated_at: TS }
  const { client, calls } = createFakeSupabase([{ data: row, error: null }])
  const result = await cycleSettings.get(client)
  const call = onlyCall(calls)
  assert.equal(call.table, 'cycle_settings')
  assert.deepEqual(call.chain, [['select', m.CYCLE_SETTINGS_COLUMNS], ['maybeSingle']])
  assert.deepEqual(result, m.toCycleSettings(row))
  noIdentity(result)

  const empty = createFakeSupabase([{ data: null, error: null }])
  assert.equal(await cycleSettings.get(empty.client), null)
})

test('cycleSettings.upsert: conflict target user_id, only supplied columns, no user_id in payload', async () => {
  const row = { id: 'cs-1', user_id: USER, reported_cycle_length: 30, reported_period_length: null, last_period_start: '2026-08-14', created_at: TS, updated_at: TS }
  const { client, calls } = createFakeSupabase([{ data: row, error: null }])
  const result = await cycleSettings.upsert(client, { reportedCycleLength: 30, lastPeriodStart: '2026-08-14', reportedPeriodLength: undefined })
  const call = onlyCall(calls)
  assert.equal(call.table, 'cycle_settings')
  assert.deepEqual(call.chain, [
    ['upsert', { reported_cycle_length: 30, last_period_start: '2026-08-14' }, { onConflict: 'user_id' }],
    ['select', m.CYCLE_SETTINGS_COLUMNS],
    ['single'],
  ])
  assert.deepEqual(result, m.toCycleSettings(row))
  noIdentity(result)

  const nulls = createFakeSupabase([{ data: row, error: null }])
  await cycleSettings.upsert(nulls.client, { lastPeriodStart: null })
  assert.deepEqual(argsOf(onlyCall(nulls.calls), 'upsert')[0], { last_period_start: null }, 'null preserved to clear the column')

  await assert.rejects(cycleSettings.upsert(createFakeSupabase().client, {}), TypeError)
  await assert.rejects(cycleSettings.upsert(createFakeSupabase().client, { userId: USER }), TypeError, 'identity-only input is empty')
})

test('cycleSettings: raw errors propagate unchanged', async () => {
  await assertPropagates((db) => cycleSettings.get(db))
  await assertPropagates((db) => cycleSettings.upsert(db, { reportedCycleLength: 28 }))
})

// ---------------------------------------------------------------------------
// cycleEvents
// ---------------------------------------------------------------------------

test('cycleEvents.list: columns, optional filters, ascending order', async () => {
  const rows = [{ id: 'e-1', user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS }]
  const plain = createFakeSupabase([{ data: rows, error: null }])
  const result = await cycleEvents.list(plain.client)
  assert.equal(onlyCall(plain.calls).table, 'cycle_events')
  assert.deepEqual(onlyCall(plain.calls).chain, [
    ['select', m.CYCLE_EVENT_COLUMNS],
    ['order', 'date', { ascending: true }],
    ['order', 'type', { ascending: true }],
  ])
  assert.deepEqual(result, rows.map(m.toCycleEvent))
  result.forEach(noIdentity)

  const filtered = createFakeSupabase([{ data: [], error: null }])
  await cycleEvents.list(filtered.client, { from: '2026-01-01', to: '2026-12-31', type: 'period_start' })
  assert.deepEqual(onlyCall(filtered.calls).chain, [
    ['select', m.CYCLE_EVENT_COLUMNS],
    ['gte', 'date', '2026-01-01'],
    ['lte', 'date', '2026-12-31'],
    ['eq', 'type', 'period_start'],
    ['order', 'date', { ascending: true }],
    ['order', 'type', { ascending: true }],
  ])
})

test('cycleEvents.getById / insert / deleteById', async () => {
  const row = { id: 'e-1', user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS }

  const get = createFakeSupabase([{ data: row, error: null }])
  assert.deepEqual(await cycleEvents.getById(get.client, 'e-1'), m.toCycleEvent(row))
  assert.deepEqual(onlyCall(get.calls).chain, [['select', m.CYCLE_EVENT_COLUMNS], ['eq', 'id', 'e-1'], ['maybeSingle']])
  assert.equal(await cycleEvents.getById(createFakeSupabase([{ data: null, error: null }]).client, 'missing'), null)

  const ins = createFakeSupabase([{ data: row, error: null }])
  const created = await cycleEvents.insert(ins.client, { type: 'period_start', date: '2026-08-14', user_id: 'attacker', id: 'forged' })
  assert.deepEqual(onlyCall(ins.calls).chain, [
    ['insert', { type: 'period_start', date: '2026-08-14' }],
    ['select', m.CYCLE_EVENT_COLUMNS],
    ['single'],
  ])
  noIdentity(created)

  const del = createFakeSupabase([{ data: [{ id: 'e-1' }], error: null }])
  assert.equal(await cycleEvents.deleteById(del.client, 'e-1'), true)
  assert.deepEqual(onlyCall(del.calls).chain, [['delete'], ['eq', 'id', 'e-1'], ['select', 'id']])
  assert.equal(await cycleEvents.deleteById(createFakeSupabase([{ data: [], error: null }]).client, 'not-mine'), false, 'RLS-hidden row → false, not an error')
})

test('cycleEvents: the unique violation propagates raw (409 is decided upstream)', async () => {
  await assertPropagates((db) => cycleEvents.insert(db, { type: 'period_start', date: '2026-08-14' }))
  await assertPropagates((db) => cycleEvents.list(db))
  await assertPropagates((db) => cycleEvents.getById(db, 'x'))
  await assertPropagates((db) => cycleEvents.deleteById(db, 'x'))
})

// ---------------------------------------------------------------------------
// observations
// ---------------------------------------------------------------------------

test('observations.upsertForDate: date in payload, conflict target user_id,date, partial columns, nulls kept', async () => {
  const row = { id: 'o-1', user_id: USER, date: '2026-09-01', mood: null, energy: 4, symptoms: ['cramps'], note: null, created_at: TS, updated_at: TS }
  const { client, calls } = createFakeSupabase([{ data: row, error: null }])
  const result = await observations.upsertForDate(client, '2026-09-01', { mood: null, symptoms: ['cramps'] })
  const call = onlyCall(calls)
  assert.equal(call.table, 'daily_observations')
  assert.deepEqual(call.chain, [
    ['upsert', { date: '2026-09-01', mood: null, symptoms: ['cramps'] }, { onConflict: 'user_id,date' }],
    ['select', m.OBSERVATION_COLUMNS],
    ['single'],
  ])
  assert.deepEqual(result, m.toObservation(row))
  assert.equal(result.mood, null)
  assert.deepEqual(result.symptoms, ['cramps'])
  noIdentity(result)

  const bare = createFakeSupabase([{ data: row, error: null }])
  await observations.upsertForDate(bare.client, '2026-09-01', {})
  assert.deepEqual(argsOf(onlyCall(bare.calls), 'upsert')[0], { date: '2026-09-01' }, 'an empty input still creates the day (defaults apply)')
})

test('observations.getByDate / list', async () => {
  const row = { id: 'o-1', user_id: USER, date: '2026-09-01', mood: 3, energy: null, symptoms: [], note: 'ok', created_at: TS, updated_at: TS }
  const get = createFakeSupabase([{ data: row, error: null }])
  assert.deepEqual(await observations.getByDate(get.client, '2026-09-01'), m.toObservation(row))
  assert.deepEqual(onlyCall(get.calls).chain, [['select', m.OBSERVATION_COLUMNS], ['eq', 'date', '2026-09-01'], ['maybeSingle']])
  assert.equal(await observations.getByDate(createFakeSupabase([{ data: null, error: null }]).client, '2026-09-02'), null, 'absence is null, never an empty observation')

  const list = createFakeSupabase([{ data: [row], error: null }])
  const result = await observations.list(list.client, { from: '2026-08-01', to: '2026-09-13' })
  assert.deepEqual(onlyCall(list.calls).chain, [
    ['select', m.OBSERVATION_COLUMNS],
    ['gte', 'date', '2026-08-01'],
    ['lte', 'date', '2026-09-13'],
    ['order', 'date', { ascending: true }],
  ])
  assert.deepEqual(result, [m.toObservation(row)])

  const open = createFakeSupabase([{ data: [], error: null }])
  await observations.list(open.client)
  assert.deepEqual(methodsOf(onlyCall(open.calls)), ['select', 'order'], 'no filters when no range')
})

test('observations: raw errors propagate', async () => {
  await assertPropagates((db) => observations.upsertForDate(db, '2026-09-01', { mood: 3 }))
  await assertPropagates((db) => observations.list(db))
  await assertPropagates((db) => observations.getByDate(db, '2026-09-01'))
})

// ---------------------------------------------------------------------------
// forecasts
// ---------------------------------------------------------------------------

const forecastRow = {
  id: 'f-1', user_id: USER, window_start: '2026-09-09', window_end: '2026-09-13', expected_period_date: '2026-09-11',
  period_uncertainty_days: 2, window_offset_uncertainty_days: 0, basis: 'observed_cycle', generated_at: TS, model_version: 'cycle-1',
}

test('forecasts.latest: newest by generated_at, limit 1, null when none', async () => {
  const { client, calls } = createFakeSupabase([{ data: forecastRow, error: null }])
  const result = await forecasts.latest(client)
  assert.equal(onlyCall(calls).table, 'forecasts')
  assert.deepEqual(onlyCall(calls).chain, [
    ['select', m.FORECAST_COLUMNS],
    ['order', 'generated_at', { ascending: false }],
    ['limit', 1],
    ['maybeSingle'],
  ])
  assert.deepEqual(result, m.toForecastSnapshot(forecastRow))
  noIdentity(result)
  assert.equal(await forecasts.latest(createFakeSupabase([{ data: null, error: null }]).client), null)
})

test('forecasts.insert: full payload, model_version included, generated_at left to the database', async () => {
  const { client, calls } = createFakeSupabase([{ data: forecastRow, error: null }])
  const snapshot = {
    windowStart: '2026-09-09', windowEnd: '2026-09-13', expectedPeriodDate: '2026-09-11',
    periodUncertaintyDays: 2, windowOffsetUncertaintyDays: 0, basis: 'observed_cycle', modelVersion: 'cycle-1',
  }
  const result = await forecasts.insert(client, snapshot)
  const [payload] = argsOf(onlyCall(calls), 'insert')
  assert.deepEqual(payload, {
    window_start: '2026-09-09', window_end: '2026-09-13', expected_period_date: '2026-09-11',
    period_uncertainty_days: 2, window_offset_uncertainty_days: 0, basis: 'observed_cycle', model_version: 'cycle-1',
  })
  assert.ok(!('generated_at' in payload) && !('user_id' in payload))
  assert.deepEqual(methodsOf(onlyCall(calls)), ['insert', 'select', 'single'])
  assert.deepEqual(result, m.toForecastSnapshot(forecastRow))
  await assert.rejects(forecasts.insert(createFakeSupabase().client, { ...snapshot, modelVersion: undefined }), TypeError)
})

test('forecasts.list: history newest first with limit', async () => {
  const { client, calls } = createFakeSupabase([{ data: [forecastRow], error: null }])
  await forecasts.list(client, { limit: 5 })
  assert.deepEqual(onlyCall(calls).chain, [['select', m.FORECAST_COLUMNS], ['order', 'generated_at', { ascending: false }], ['limit', 5]])
  const dflt = createFakeSupabase([{ data: [], error: null }])
  await forecasts.list(dflt.client)
  assert.deepEqual(argsOf(onlyCall(dflt.calls), 'limit'), [20])
})

test('forecasts: append-only — no update/delete export and no such call in source', async () => {
  assert.deepEqual(Object.keys(forecasts).sort(), ['insert', 'latest', 'list'])
  const source = await readFile(new URL('../src/repositories/forecasts.js', import.meta.url), 'utf8')
  assert.ok(!source.includes('.update(') && !source.includes('.delete('))
  await assertPropagates((db) => forecasts.latest(db))
  await assertPropagates((db) => forecasts.insert(db, { windowStart: 'a', windowEnd: 'b', expectedPeriodDate: 'c', periodUncertaintyDays: 1, windowOffsetUncertaintyDays: 0, basis: 'observed_cycle', modelVersion: 'cycle-1' }))
})

// ---------------------------------------------------------------------------
// patternEvidence
// ---------------------------------------------------------------------------

const evidence = [{ cycleIndex: 0, cycleStart: '2026-06-20', observedOn: ['2026-07-10'], cycleDays: [21], phase: 'luteal', supports: true, sparse: false }]
const patternRow = {
  id: 'p-1', user_id: USER, pattern_type: 'symptom', signal: 'cramps', phase: 'luteal', confidence_tier: 'likely',
  supporting_cycles: 3, assessable_cycles: 4, consistency: '0.750', evidence, range_start: '2026-06-20', range_end: '2026-09-01', computed_at: TS,
}
const assessment = {
  target: { kind: 'symptom', key: 'cramps' }, tier: 'likely', totalCycles: 5, assessableCycles: 4, supportingCycles: 3, sparseCycles: 1,
  consistency: 0.75, dominantPhase: 'luteal', evidence, summary: 'Cramps has shown up during the luteal phase in 3 of 4 tracked cycles.', caveats: [],
}
const meta = { rangeStart: '2026-06-20', rangeEnd: '2026-09-01', computedAt: TS }

test('patternEvidence.list: columns and deterministic ordering', async () => {
  const { client, calls } = createFakeSupabase([{ data: [patternRow], error: null }])
  const result = await patternEvidence.list(client)
  assert.equal(onlyCall(calls).table, 'pattern_evidence')
  assert.deepEqual(onlyCall(calls).chain, [
    ['select', m.PATTERN_EVIDENCE_COLUMNS],
    ['order', 'computed_at', { ascending: false }],
    ['order', 'pattern_type', { ascending: true }],
    ['order', 'signal', { ascending: true }],
  ])
  assert.equal(result[0].consistency, 0.75)
  noIdentity(result[0])
})

test('patternEvidence.upsert / upsertMany: unique key conflict target, structured evidence only, no prose', async () => {
  const one = createFakeSupabase([{ data: patternRow, error: null }])
  const result = await patternEvidence.upsert(one.client, assessment, meta)
  const call = onlyCall(one.calls)
  const [payload, options] = argsOf(call, 'upsert')
  assert.deepEqual(options, { onConflict: 'user_id,pattern_type,signal' })
  assert.deepEqual(payload, m.toPatternEvidenceRow(assessment, meta))
  assert.ok(!('summary' in payload) && !('caveats' in payload) && !('user_id' in payload))
  assert.equal(payload.computed_at, TS, 'computed_at is always written so an upsert refreshes it')
  assert.deepEqual(methodsOf(call), ['upsert', 'select', 'single'])
  assert.deepEqual(result, m.toPatternEvidenceRecord(patternRow))

  const many = createFakeSupabase([{ data: [patternRow, patternRow], error: null }])
  const second = { ...assessment, target: { kind: 'mood', key: 'low' }, tier: 'emerging' }
  const results = await patternEvidence.upsertMany(many.client, [assessment, second], meta)
  const [rows, opts] = argsOf(onlyCall(many.calls), 'upsert')
  assert.equal(rows.length, 2)
  assert.deepEqual(Object.keys(rows[0]), Object.keys(rows[1]), 'bulk rows share one column set')
  assert.deepEqual(opts, { onConflict: 'user_id,pattern_type,signal' })
  assert.deepEqual(methodsOf(onlyCall(many.calls)), ['upsert', 'select'])
  assert.equal(results.length, 2)

  const none = createFakeSupabase()
  assert.deepEqual(await patternEvidence.upsertMany(none.client, [], meta), [])
  assert.equal(none.calls.length, 0, 'no query for an empty batch')
  await assert.rejects(patternEvidence.upsert(createFakeSupabase().client, { ...assessment, tier: 'none' }, meta), /never persisted/)
})

test('patternEvidence.deleteForPattern: keyed delete, boolean result', async () => {
  const { client, calls } = createFakeSupabase([{ data: [{ id: 'p-1' }], error: null }])
  assert.equal(await patternEvidence.deleteForPattern(client, 'symptom', 'cramps'), true)
  assert.deepEqual(onlyCall(calls).chain, [['delete'], ['eq', 'pattern_type', 'symptom'], ['eq', 'signal', 'cramps'], ['select', 'id']])
  assert.equal(await patternEvidence.deleteForPattern(createFakeSupabase([{ data: [], error: null }]).client, 'mood', 'low'), false)
  await assertPropagates((db) => patternEvidence.list(db))
  await assertPropagates((db) => patternEvidence.upsert(db, assessment, meta))
  await assertPropagates((db) => patternEvidence.deleteForPattern(db, 'symptom', 'cramps'))
})

// ---------------------------------------------------------------------------
// subscription
// ---------------------------------------------------------------------------

test('subscription.get: select-only, contract shape, no writes exist', async () => {
  const row = { user_id: USER, is_plus: true, entitlement: 'plus', source: 'revenuecat', updated_at: TS }
  const { client, calls } = createFakeSupabase([{ data: row, error: null }])
  const result = await subscription.get(client)
  assert.equal(onlyCall(calls).table, 'subscription_state')
  assert.deepEqual(onlyCall(calls).chain, [['select', m.SUBSCRIPTION_COLUMNS], ['maybeSingle']])
  assert.deepEqual(result, { isPlus: true, entitlement: 'plus', source: 'revenuecat', updatedAt: TS })
  noIdentity(result)
  assert.deepEqual(Object.keys(subscription), ['get'])
  assert.equal(await subscription.get(createFakeSupabase([{ data: null, error: null }]).client), null)
  await assertPropagates((db) => subscription.get(db))
})

// ---------------------------------------------------------------------------
// journal
// ---------------------------------------------------------------------------

const journalRow = { id: 'j-1', user_id: USER, entry_date: '2026-09-01', title: null, body: 'hello', created_at: TS, updated_at: TS }

test('journal.list: newest first, optional range and limit', async () => {
  const { client, calls } = createFakeSupabase([{ data: [journalRow], error: null }])
  const result = await journal.list(client, { from: '2026-08-01', to: '2026-09-13', limit: 50 })
  assert.equal(onlyCall(calls).table, 'journal_entries')
  assert.deepEqual(onlyCall(calls).chain, [
    ['select', m.JOURNAL_COLUMNS],
    ['gte', 'entry_date', '2026-08-01'],
    ['lte', 'entry_date', '2026-09-13'],
    ['order', 'entry_date', { ascending: false }],
    ['order', 'created_at', { ascending: false }],
    ['limit', 50],
  ])
  assert.deepEqual(result, [m.toJournalEntry(journalRow)])
  result.forEach(noIdentity)

  const bare = createFakeSupabase([{ data: [], error: null }])
  await journal.list(bare.client)
  assert.deepEqual(methodsOf(onlyCall(bare.calls)), ['select', 'order', 'order'])
})

test('journal.getById / create / update / delete', async () => {
  const get = createFakeSupabase([{ data: journalRow, error: null }])
  assert.deepEqual(await journal.getById(get.client, 'j-1'), m.toJournalEntry(journalRow))
  assert.deepEqual(onlyCall(get.calls).chain, [['select', m.JOURNAL_COLUMNS], ['eq', 'id', 'j-1'], ['maybeSingle']])

  const create = createFakeSupabase([{ data: journalRow, error: null }])
  await journal.create(create.client, { body: 'hello', entryDate: '2026-09-01', title: null, user_id: USER })
  assert.deepEqual(onlyCall(create.calls).chain, [
    ['insert', { entry_date: '2026-09-01', title: null, body: 'hello' }],
    ['select', m.JOURNAL_COLUMNS],
    ['single'],
  ])

  const update = createFakeSupabase([{ data: { ...journalRow, title: 'T' }, error: null }])
  const updated = await journal.update(update.client, 'j-1', { title: 'T' })
  assert.deepEqual(onlyCall(update.calls).chain, [['update', { title: 'T' }], ['eq', 'id', 'j-1'], ['select', m.JOURNAL_COLUMNS], ['maybeSingle']])
  assert.equal(updated.title, 'T')
  assert.equal(await journal.update(createFakeSupabase([{ data: null, error: null }]).client, 'not-mine', { title: 'x' }), null)
  await assert.rejects(journal.update(createFakeSupabase().client, 'j-1', {}), TypeError)

  const del = createFakeSupabase([{ data: [{ id: 'j-1' }], error: null }])
  assert.equal(await journal.delete(del.client, 'j-1'), true)
  assert.deepEqual(onlyCall(del.calls).chain, [['delete'], ['eq', 'id', 'j-1'], ['select', 'id']])
  assert.equal(await journal.delete(createFakeSupabase([{ data: [], error: null }]).client, 'x'), false)

  await assertPropagates((db) => journal.create(db, { body: 'x' }))
  await assertPropagates((db) => journal.update(db, 'j-1', { body: 'x' }))
  await assertPropagates((db) => journal.delete(db, 'j-1'))
  await assertPropagates((db) => journal.list(db))
})

// ---------------------------------------------------------------------------
// Security: no service role, no user_id as a security mechanism, no HTTP/auth/engine logic
// ---------------------------------------------------------------------------

test('repositories never import the service client, filter on user_id, or contain non-persistence logic', async () => {
  const dir = new URL('../src/repositories/', import.meta.url)
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js'))
  assert.ok(files.length >= 8)
  for (const file of files) {
    const raw = await readFile(new URL(file, dir), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const forbidden of [
      'createServiceClient', 'SERVICE_ROLE', "lib/supabase", 'createClient(', // service role / client construction
      ".eq('user_id'", 'user_id:', 'req.user', 'req.headers', 'authorization', 'getUser(', // identity handling
      'res.', 'status(', // HTTP
      'engines/', 'computeCycleStats', 'assessPattern', 'moodBucketFor', 'isPlus', // business logic
      'fetch(', 'process.env', 'Date.now(', // I/O and clock
    ]) {
      assert.ok(!code.includes(forbidden), `${file} contains "${forbidden}"`)
    }
    const userIdMentions = [...code.matchAll(/user_id/g)].length
    const onConflictMentions = [...code.matchAll(/onConflict: '[^']*user_id[^']*'|CONFLICT_TARGET = '[^']*user_id[^']*'/g)].length
    assert.equal(userIdMentions, onConflictMentions, `${file}: user_id may appear only inside an onConflict target`)
  }
})
