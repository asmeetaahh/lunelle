import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as m from '../src/lib/mappers.js'

const USER = '11111111-1111-1111-1111-111111111111'
const TS = '2026-09-13T14:00:00.123456+00:00'

/** Keys of the frozen shared interface, parsed from shared/types.ts. */
const sharedSrc = readFileSync(new URL('../../shared/types.ts', import.meta.url), 'utf8')
function sharedKeys(name) {
  const match = sharedSrc.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`))
  return [...match[1].matchAll(/^\s*([a-zA-Z]+)\??:/gm)].map((x) => x[1]).sort()
}

const assertNoIdentity = (obj) => {
  const text = JSON.stringify(obj)
  assert.ok(!('user_id' in obj) && !('userId' in obj), 'no identity key')
  assert.ok(!text.includes(USER), 'no user id value')
}

test('column lists never include user_id', () => {
  for (const name of Object.keys(m).filter((k) => k.endsWith('_COLUMNS'))) {
    assert.ok(!m[name].split(',').map((c) => c.trim()).includes('user_id'), name)
  }
})

test('toProfile / toCycleSettings match the shared shapes and drop user_id', () => {
  const profile = m.toProfile({ id: USER, display_name: null, timezone: 'Europe/London', created_at: TS, updated_at: TS, extra_col: 'x' })
  assert.deepEqual(Object.keys(profile).sort(), sharedKeys('Profile'))
  assert.equal(profile.displayName, null)
  assert.equal(profile.createdAt, TS, 'timestamp passed through unchanged')
  assert.ok(!('extra_col' in profile) && !('extraCol' in profile), 'unknown columns are not copied')

  const settings = m.toCycleSettings({
    id: 'cs-1', user_id: USER, reported_cycle_length: 28, reported_period_length: null, last_period_start: '2026-08-14', created_at: TS, updated_at: TS,
  })
  assert.deepEqual(Object.keys(settings).sort(), sharedKeys('CycleSettings'))
  assert.deepEqual(settings, { id: 'cs-1', reportedCycleLength: 28, reportedPeriodLength: null, lastPeriodStart: '2026-08-14', createdAt: TS, updatedAt: TS })
  assertNoIdentity(settings)
})

test('toCycleSettingsRow: present keys copied, null preserved, undefined skipped, nothing invented', () => {
  assert.deepEqual(m.toCycleSettingsRow({ reportedCycleLength: 30, lastPeriodStart: null }), { reported_cycle_length: 30, last_period_start: null })
  assert.deepEqual(m.toCycleSettingsRow({ reportedPeriodLength: undefined }), {})
  assert.deepEqual(m.toCycleSettingsRow({}), {})
  assert.deepEqual(m.toCycleSettingsRow({ userId: USER, user_id: USER, reportedCycleLength: 28 }), { reported_cycle_length: 28 }, 'identity keys ignored')
})

test('toCycleEvent / toCycleEventRow', () => {
  const event = m.toCycleEvent({ id: 'e-1', user_id: USER, type: 'period_start', date: '2026-08-14', created_at: TS })
  assert.deepEqual(Object.keys(event).sort(), sharedKeys('CycleEvent'))
  assert.deepEqual(event, { id: 'e-1', type: 'period_start', date: '2026-08-14', createdAt: TS })
  assertNoIdentity(event)
  assert.deepEqual(m.toCycleEventRow({ type: 'period_end', date: '2026-08-18', user_id: USER }), { type: 'period_end', date: '2026-08-18' })
})

test('toObservation / toObservationRow preserve nulls, arrays and note', () => {
  const symptoms = ['cramps', 'fatigue']
  const obs = m.toObservation({ id: 'o-1', user_id: USER, date: '2026-09-01', mood: null, energy: 4, symptoms, note: null, created_at: TS, updated_at: TS })
  assert.deepEqual(Object.keys(obs).sort(), sharedKeys('DailyObservation'))
  assert.deepEqual(obs.symptoms, symptoms)
  assert.notEqual(obs.symptoms, symptoms, 'array copied, not aliased')
  assert.equal(obs.mood, null)
  assert.equal(obs.note, null)
  assertNoIdentity(obs)

  assert.deepEqual(m.toObservationRow({ mood: null, symptoms: [], note: 'ok' }), { mood: null, symptoms: [], note: 'ok' })
  assert.deepEqual(m.toObservationRow({ energy: 2 }), { energy: 2 })
  assert.deepEqual(m.toObservationRow({}), {})
})

test('toJournalEntry / toJournalEntryRow', () => {
  const entry = m.toJournalEntry({ id: 'j-1', user_id: USER, entry_date: '2026-09-01', title: null, body: 'hello', created_at: TS, updated_at: TS })
  assert.deepEqual(Object.keys(entry).sort(), sharedKeys('JournalEntry'))
  assert.equal(entry.entryDate, '2026-09-01')
  assert.equal(entry.title, null)
  assertNoIdentity(entry)
  assert.deepEqual(m.toJournalEntryRow({ body: 'b', title: null }), { body: 'b', title: null })
  assert.deepEqual(m.toJournalEntryRow({ entryDate: '2026-09-02' }), { entry_date: '2026-09-02' })
})

test('toSubscriptionState matches the shared shape and exposes no identity', () => {
  const sub = m.toSubscriptionState({ user_id: USER, is_plus: false, entitlement: null, source: 'revenuecat', updated_at: TS })
  assert.deepEqual(Object.keys(sub).sort(), sharedKeys('SubscriptionState'))
  assert.deepEqual(sub, { isPlus: false, entitlement: null, source: 'revenuecat', updatedAt: TS })
  assertNoIdentity(sub)
})

test('forecast snapshot mapping is a pure column rename; insert payload requires every field', () => {
  const row = {
    id: 'f-1', user_id: USER, window_start: '2026-09-09', window_end: '2026-09-13', expected_period_date: '2026-09-11',
    period_uncertainty_days: 2, window_offset_uncertainty_days: 0, basis: 'observed_cycle', generated_at: TS, model_version: 'cycle-1',
  }
  const snap = m.toForecastSnapshot(row)
  assert.deepEqual(snap, {
    id: 'f-1', windowStart: '2026-09-09', windowEnd: '2026-09-13', expectedPeriodDate: '2026-09-11',
    periodUncertaintyDays: 2, windowOffsetUncertaintyDays: 0, basis: 'observed_cycle', generatedAt: TS, modelVersion: 'cycle-1',
  })
  assertNoIdentity(snap)

  const { id: _i, generatedAt: _g, ...input } = snap
  const { id: _ri, user_id: _ru, generated_at: _rg, ...expectedRow } = row
  assert.deepEqual(m.toForecastRow(input), expectedRow)
  assert.throws(() => m.toForecastRow({ ...input, modelVersion: undefined }), /modelVersion is required/)
  assert.throws(() => m.toForecastRow({ ...input, basis: undefined }), /basis is required/)
})

test('pattern evidence mapping keeps numeric precision, arrays and nulls; never persists tier none', () => {
  const evidence = [{ cycleIndex: 0, cycleStart: '2026-06-20', observedOn: ['2026-07-10'], cycleDays: [21], phase: 'luteal', supports: true, sparse: false }]
  const record = m.toPatternEvidenceRecord({
    id: 'p-1', user_id: USER, pattern_type: 'symptom', signal: 'cramps', phase: 'luteal', confidence_tier: 'emerging',
    supporting_cycles: 2, assessable_cycles: 3, consistency: '0.667', evidence, range_start: null, range_end: null, computed_at: TS,
  })
  assert.equal(record.consistency, 0.667, 'numeric string → number, 3 dp kept')
  assert.deepEqual(record.evidence, evidence)
  assert.notEqual(record.evidence, evidence)
  assert.equal(record.rangeStart, null)
  assertNoIdentity(record)

  const assessment = {
    target: { kind: 'symptom', key: 'cramps' }, tier: 'likely', totalCycles: 4, assessableCycles: 3, supportingCycles: 3, sparseCycles: 1,
    consistency: 1, dominantPhase: 'luteal', evidence, summary: 'prose', caveats: ['c'],
  }
  const row = m.toPatternEvidenceRow(assessment, { rangeStart: '2026-06-20', rangeEnd: '2026-09-01', computedAt: TS })
  assert.deepEqual(row, {
    pattern_type: 'symptom', signal: 'cramps', phase: 'luteal', confidence_tier: 'likely', supporting_cycles: 3, assessable_cycles: 3,
    consistency: 1, evidence, range_start: '2026-06-20', range_end: '2026-09-01', computed_at: TS,
  })
  assert.ok(!('summary' in row) && !JSON.stringify(row).includes('prose'), 'summary/caveats are never stored')
  assert.throws(() => m.toPatternEvidenceRow({ ...assessment, tier: 'none' }, { rangeStart: null, rangeEnd: null, computedAt: TS }), /never persisted/)
  assert.throws(() => m.toPatternEvidenceRow(assessment, { rangeStart: null, rangeEnd: null }), /computedAt/)
  assert.throws(() => m.toPatternEvidenceRow(assessment, { computedAt: TS }), /rangeStart/)
})

test('row mappers reject non-rows instead of fabricating objects', () => {
  for (const fn of [m.toProfile, m.toCycleSettings, m.toCycleEvent, m.toObservation, m.toJournalEntry, m.toForecastSnapshot, m.toPatternEvidenceRecord, m.toSubscriptionState]) {
    assert.throws(() => fn(null), TypeError)
    assert.throws(() => fn(undefined), TypeError)
  }
})
