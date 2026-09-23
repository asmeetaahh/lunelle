import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as common from '../src/schemas/common.js'
import { cycleSettingsBody } from '../src/schemas/cycleSettings.js'
import { cycleEventBody, cycleEventsQuery, cycleEventParams } from '../src/schemas/cycleEvents.js'
import { observationBody, observationParams, observationsQuery } from '../src/schemas/observations.js'
import { deleteAccountBody } from '../src/schemas/account.js'
import * as shared from '../../shared/constants.ts'

const okay = (schema, value) => schema.safeParse(value).success
const paths = (schema, value) => schema.safeParse(value).error.issues.map((i) => i.path.join('.'))

test('schema bounds are pinned to shared/constants.ts (no competing values)', () => {
  assert.deepEqual(common.MOOD_SCALE, shared.MOOD_SCALE)
  assert.deepEqual(common.ENERGY_SCALE, shared.ENERGY_SCALE)
  assert.deepEqual(common.CYCLE_LENGTH_RANGE, shared.CYCLE_LENGTH_RANGE)
  assert.deepEqual(common.PERIOD_LENGTH_RANGE, shared.PERIOD_LENGTH_RANGE)
  assert.equal(common.OBSERVATION_NOTE_MAX, shared.TEXT_LIMITS.observationNote)
  assert.equal(common.MAX_SYMPTOMS_PER_DAY, shared.MAX_SYMPTOMS_PER_DAY)
  assert.deepEqual(common.DATE_BOUNDS, shared.DATE_BOUNDS)
  assert.equal(common.DEFAULT_OBSERVATION_RANGE_DAYS, shared.DEFAULT_OBSERVATION_RANGE_DAYS)
  assert.deepEqual([...common.CYCLE_EVENT_TYPES], [...shared.CYCLE_EVENT_TYPES])
  assert.deepEqual([...common.SYMPTOMS], [...shared.SYMPTOMS])
})

test('isoDate: real calendar days inside DATE_BOUNDS only', () => {
  for (const good of ['2026-09-13', '2028-02-29', '2000-01-01', '2100-12-31']) assert.ok(okay(common.isoDate, good), good)
  for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '1999-12-31', '2101-01-01', '2026-9-1', '2026/09/13', 'today', '', 20260913]) {
    assert.ok(!okay(common.isoDate, bad), String(bad))
  }
})

test('cycleSettingsBody: ranges, nulls, partial merge, strict keys, non-empty', () => {
  assert.ok(okay(cycleSettingsBody, { reportedCycleLength: 28 }))
  assert.ok(okay(cycleSettingsBody, { reportedCycleLength: 15, reportedPeriodLength: 14, lastPeriodStart: '2026-08-14' }))
  assert.ok(okay(cycleSettingsBody, { reportedCycleLength: null }), 'null clears')
  assert.ok(okay(cycleSettingsBody, { lastPeriodStart: null }))
  assert.ok(!okay(cycleSettingsBody, {}), 'empty merge rejected')
  assert.ok(!okay(cycleSettingsBody, { reportedCycleLength: undefined }), 'undefined-only is empty')
  assert.deepEqual(paths(cycleSettingsBody, { reportedCycleLength: 14 }), ['reportedCycleLength'])
  assert.deepEqual(paths(cycleSettingsBody, { reportedCycleLength: 61 }), ['reportedCycleLength'])
  assert.deepEqual(paths(cycleSettingsBody, { reportedPeriodLength: 0 }), ['reportedPeriodLength'])
  assert.deepEqual(paths(cycleSettingsBody, { reportedPeriodLength: 15 }), ['reportedPeriodLength'])
  assert.deepEqual(paths(cycleSettingsBody, { reportedCycleLength: 28.5 }), ['reportedCycleLength'])
  assert.deepEqual(paths(cycleSettingsBody, { reportedCycleLength: '28' }), ['reportedCycleLength'])
  assert.deepEqual(paths(cycleSettingsBody, { lastPeriodStart: '2026-02-30' }), ['lastPeriodStart'])
  assert.ok(!okay(cycleSettingsBody, { reportedCycleLength: 28, user_id: 'x' }), 'user_id rejected')
  assert.ok(!okay(cycleSettingsBody, { reportedCycleLength: 28, userId: 'x' }))
})

test('cycleEventBody / cycleEventsQuery / cycleEventParams', () => {
  assert.ok(okay(cycleEventBody, { type: 'period_start', date: '2026-08-14' }))
  assert.ok(okay(cycleEventBody, { type: 'period_end', date: '2026-08-18' }))
  assert.ok(!okay(cycleEventBody, { type: 'ovulation', date: '2026-08-14' }))
  assert.ok(!okay(cycleEventBody, { type: 'period_start', date: '2026-02-30' }))
  assert.ok(!okay(cycleEventBody, { type: 'period_start' }))
  assert.ok(!okay(cycleEventBody, { type: 'period_start', date: '2026-08-14', user_id: 'x' }))
  assert.ok(!okay(cycleEventBody, { type: 'period_start', date: '2026-08-14', duration: 5 }), 'V1 duration field rejected')

  assert.ok(okay(cycleEventsQuery, {}))
  assert.ok(okay(cycleEventsQuery, { from: '2026-01-01', to: '2026-12-31', type: 'period_start' }))
  assert.ok(!okay(cycleEventsQuery, { from: '2026-02-01', to: '2026-01-01' }), 'from > to')
  assert.ok(!okay(cycleEventsQuery, { type: 'x' }))
  assert.ok(!okay(cycleEventsQuery, { limit: 5 }), 'unknown query keys rejected')

  assert.ok(okay(cycleEventParams, { id: '11111111-1111-4111-8111-111111111111' }))
  assert.ok(!okay(cycleEventParams, { id: 'p-1' }))
})

test('observationBody: scales, vocabulary, uniqueness, note length, nulls, non-empty, strict', () => {
  assert.ok(okay(observationBody, { mood: 1, energy: 5, symptoms: ['cramps', 'fatigue'], note: 'ok' }))
  assert.ok(okay(observationBody, { mood: null }), 'null clears')
  assert.ok(okay(observationBody, { symptoms: [] }), 'empty symptoms clears')
  assert.ok(okay(observationBody, { note: null }))
  assert.ok(okay(observationBody, { note: 'x'.repeat(500) }))
  assert.ok(okay(observationBody, { symptoms: [...shared.SYMPTOMS] }), 'all 20 accepted')
  assert.ok(!okay(observationBody, {}), 'empty observation rejected')
  assert.deepEqual(paths(observationBody, { mood: 0 }), ['mood'])
  assert.deepEqual(paths(observationBody, { mood: 6 }), ['mood'])
  assert.deepEqual(paths(observationBody, { energy: 2.5 }), ['energy'])
  assert.deepEqual(paths(observationBody, { mood: '3' }), ['mood'])
  assert.deepEqual(paths(observationBody, { symptoms: ['unicorns'] }), ['symptoms.0'])
  assert.deepEqual(paths(observationBody, { symptoms: ['cramps', 'cramps'] }), ['symptoms'])
  assert.deepEqual(paths(observationBody, { note: 'x'.repeat(501) }), ['note'])
  assert.ok(!okay(observationBody, { mood: 3, user_id: 'x' }))
  assert.ok(!okay(observationBody, { mood: 3, cycleDay: 4 }), 'derived fields cannot be written')

  assert.ok(okay(observationParams, { date: '2026-09-13' }))
  assert.ok(!okay(observationParams, { date: '2026-09-31' }))
  assert.ok(okay(observationsQuery, { from: '2026-06-01' }))
  assert.ok(!okay(observationsQuery, { from: '2026-06-02', to: '2026-06-01' }))
})

test('deleteAccountBody: only an empty body is acceptable', () => {
  assert.ok(okay(deleteAccountBody, {}))
  assert.ok(!okay(deleteAccountBody, { userId: '11111111-1111-4111-8111-111111111111' }))
  assert.ok(!okay(deleteAccountBody, { confirm: true }))
})
