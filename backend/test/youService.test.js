import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createYouService, buildCycleSummaries, buildPatternInput, stableStringify, EVIDENCE_COMPARE_KEYS } from '../src/services/youService.js'
import { buildCycleInput } from '../src/services/cycleService.js'
import * as cycle from '../src/engines/cycle.js'
import * as pattern from '../src/engines/patternConfidence.js'
import * as shared from '../../shared/constants.ts'

const TS = '2026-09-13T14:00:00+00:00'
const NOW = new Date('2026-09-13T15:04:05.000Z')
const DB = { scoped: true }
const AS_OF = '2026-06-01'

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const startsFrom = (first, lengths) => lengths.reduce((acc, len) => [...acc, addDays(acc[acc.length - 1], len)], [first])

/** Six 28-day starts (five completed cycles), last start 2026-05-25. */
const REGULAR = startsFrom('2026-01-05', [28, 28, 28, 28, 28])

const settingsOf = (over = {}) => ({ id: 'cs-1', reportedCycleLength: null, reportedPeriodLength: null, lastPeriodStart: null, createdAt: TS, updatedAt: TS, ...over })
const eventOf = (date, type = 'period_start') => ({ id: `e-${type}-${date}`, type, date, createdAt: TS })
const obsOf = (date, over = {}) => ({ id: `o-${date}`, date, mood: null, energy: null, symptoms: [], note: null, createdAt: TS, updatedAt: TS, ...over })

/** Regular history with 4-day periods; cramps on day 21 and low mood on day 24 of every completed cycle. */
function regularFixture() {
  const events = REGULAR.flatMap((d) => [eventOf(d), eventOf(addDays(d, 3), 'period_end')])
  const observations = REGULAR.slice(0, 5).flatMap((d) => [
    obsOf(addDays(d, 20), { symptoms: ['cramps'], mood: 3, energy: 2 }),
    obsOf(addDays(d, 23), { mood: 2, symptoms: ['cramps', 'fatigue'] }),
    obsOf(addDays(d, 8), { mood: 4 }),
    ...[1, 2, 5, 10, 12, 15].map((n) => obsOf(addDays(d, n), { energy: 3 })), // padding so each cycle is assessable (≥5 logged days)
  ])
  return { events, observations }
}

function fakes({ settings = null, events = [], observations = [], stored = [], now = () => NOW } = {}) {
  const calls = []
  const repos = {
    cycleSettings: { get: async (db) => (calls.push(['settings.get', db]), settings) },
    cycleEvents: { list: async (db, range) => (calls.push(['events.list', db, range]), events) },
    observations: { list: async (db, range) => (calls.push(['observations.list', db, range]), observations) },
    patternEvidence: {
      list: async (db) => (calls.push(['evidence.list', db]), stored),
      upsertMany: async (db, assessments, meta) => (calls.push(['evidence.upsertMany', db, assessments, meta]), []),
      deleteForPattern: async (db, type, signal) => (calls.push(['evidence.deleteForPattern', db, type, signal]), true),
    },
  }
  return { calls, names: () => calls.map(([n]) => n), service: createYouService({ ...repos, now }) }
}

/** A stored record equivalent to a fresh assessment (as the repository would return it). */
const storedFrom = (a, { rangeStart, rangeEnd, computedAt = TS, id = 'p-1' } = {}) => ({
  id, patternType: a.target.kind, signal: a.target.key, phase: a.dominantPhase, confidenceTier: a.tier,
  supportingCycles: a.supportingCycles, assessableCycles: a.assessableCycles, consistency: a.consistency,
  evidence: JSON.parse(JSON.stringify(a.evidence)), rangeStart, rangeEnd, computedAt,
})

const CAUSAL = /\b(cause|causes|caused|because|due to|leads? to|triggers?|results? in|makes you|diagnos)\w*/i

// ---------------------------------------------------------------------------
// Empty / stats
// ---------------------------------------------------------------------------

test('no cycle settings and no data → empty snapshot, evidence listed once, nothing written', async () => {
  const f = fakes()
  const you = await f.service.getYou(DB, AS_OF)
  assert.deepEqual(you, { stats: cycle.computeCycleStats({ periodStartDates: [] }), cycles: [], patterns: [] })
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'evidence.list'])
  assert.deepEqual(f.calls[1][2], { to: AS_OF })
  assert.deepEqual(f.calls[2][2], { to: AS_OF })
})

test('stats are exactly cycleService\'s input model through the engine — no second formula', async () => {
  const { events } = regularFixture()
  const settings = settingsOf({ reportedCycleLength: 35, reportedPeriodLength: 4 })
  const you = await fakes({ settings, events }).service.getYou(DB, AS_OF)
  assert.deepEqual(you.stats, cycle.computeCycleStats(buildCycleInput(settings, events, AS_OF)))
  assert.equal(you.stats.lengthSource, 'history')
  assert.equal(you.stats.typicalLength, 28)
  const thin = await fakes({ settings: settingsOf({ reportedCycleLength: 30 }), events: [eventOf('2026-05-01')] }).service.getYou(DB, AS_OF)
  assert.equal(thin.stats.lengthSource, 'reported')
})

// ---------------------------------------------------------------------------
// CycleSummary
// ---------------------------------------------------------------------------

test('cycle summaries: newest first, current detection, period length, open cycle, no fabrication', () => {
  const events = [
    eventOf('2026-03-02'), eventOf('2026-03-05', 'period_end'),
    eventOf('2026-03-30'), // no period_end logged
    eventOf('2026-04-27'), eventOf('2026-05-01', 'period_end'),
  ]
  assert.deepEqual(buildCycleSummaries(events, AS_OF), [
    { startDate: '2026-04-27', endDate: null, cycleLength: null, periodLength: 5, isCurrent: true },
    { startDate: '2026-03-30', endDate: '2026-04-26', cycleLength: 28, periodLength: null, isCurrent: false },
    { startDate: '2026-03-02', endDate: '2026-03-29', cycleLength: 28, periodLength: 4, isCurrent: false },
  ])
})

test('cycle summaries: only events on/before asOfDate exist; a period_end outside its cycle is not attributed', () => {
  const events = [
    eventOf('2026-02-20', 'period_end'), // before any start → belongs to nothing
    eventOf('2026-03-02'), eventOf('2026-03-30'),
    eventOf('2026-06-10'), // future start (when asOf = 05-15)
    eventOf('2026-06-15', 'period_end'), // future end; once visible it belongs to the 06-10 cycle, not the 03-30 one
  ]
  const summaries = buildCycleSummaries(events, '2026-05-15')
  assert.deepEqual(summaries.map((s) => [s.startDate, s.isCurrent, s.periodLength]), [['2026-03-30', true, null], ['2026-03-02', false, null]])
  // Move asOfDate past the future events: they become history and the current cycle changes.
  const later = buildCycleSummaries(events, '2026-06-30')
  assert.deepEqual(later.map((s) => [s.startDate, s.isCurrent, s.periodLength, s.cycleLength]), [
    ['2026-06-10', true, 6, null],
    ['2026-03-30', false, null, 72], // an end after the next start is never attributed backwards; the 72-day span is reported as-is, not judged
    ['2026-03-02', false, null, 28],
  ])
  assert.deepEqual(buildCycleSummaries([], AS_OF), [])
})

// ---------------------------------------------------------------------------
// Pattern input
// ---------------------------------------------------------------------------

test('observation conversion: symptoms pass through, mood buckets, energy ignored, empty days produce nothing', () => {
  const summaries = buildCycleSummaries([eventOf('2026-05-01'), eventOf('2026-05-29')], AS_OF)
  const observations = [
    obsOf('2026-05-02', { mood: 1, symptoms: ['cramps', 'headache'], energy: 5 }),
    obsOf('2026-05-03', { mood: 2 }),
    obsOf('2026-05-04', { mood: 3 }),
    obsOf('2026-05-05', { mood: 4 }),
    obsOf('2026-05-06', { mood: 5, energy: 1 }),
    obsOf('2026-05-07', { energy: 2, note: 'only energy and a note' }),
    obsOf('2026-05-08', { symptoms: [] }),
  ]
  const input = buildPatternInput(summaries, observations, 28, AS_OF)
  assert.deepEqual(input.observations, [
    { date: '2026-05-02', kind: 'symptom', key: 'cramps' },
    { date: '2026-05-02', kind: 'symptom', key: 'headache' },
    { date: '2026-05-02', kind: 'mood', key: 'low', intensity: 1 },
    { date: '2026-05-03', kind: 'mood', key: 'low', intensity: 2 },
    { date: '2026-05-04', kind: 'mood', key: 'neutral', intensity: 3 },
    { date: '2026-05-05', kind: 'mood', key: 'high', intensity: 4 },
    { date: '2026-05-06', kind: 'mood', key: 'high', intensity: 5 },
  ])
  assert.ok(input.observations.every((o) => o.kind !== 'mood' || pattern.MOOD_BUCKETS.includes(o.key)))
  assert.ok(input.observations.every((o) => o.kind !== 'symptom' || shared.SYMPTOMS.includes(o.key)))
  assert.deepEqual(input.cycles, [
    { index: 0, startDate: '2026-05-01', endDate: '2026-05-28', typicalLength: 28, loggedDays: 7 },
    { index: 1, startDate: '2026-05-29', endDate: null, typicalLength: 28, loggedDays: 0 },
  ])
})

test('pattern windows: actual length for completed cycles, stats length for the open one, implausible gaps excluded, loggedDays per window', () => {
  const events = [eventOf('2026-01-01'), eventOf('2026-01-31'), eventOf('2026-05-03'), eventOf('2026-05-30')] // 30, 92 (gap), 27, open
  const observations = [obsOf('2026-01-05', { mood: 3 }), obsOf('2026-03-01', { mood: 3 }), obsOf('2026-05-10', { mood: 3 }), obsOf('2026-05-31', { mood: 3 })]
  const input = buildPatternInput(buildCycleSummaries(events, AS_OF), observations, 29, AS_OF)
  assert.deepEqual(input.cycles, [
    { index: 0, startDate: '2026-01-01', endDate: '2026-01-30', typicalLength: 30, loggedDays: 1 },
    { index: 1, startDate: '2026-05-03', endDate: '2026-05-29', typicalLength: 27, loggedDays: 1 },
    { index: 2, startDate: '2026-05-30', endDate: null, typicalLength: 29, loggedDays: 1 },
  ])
  assert.ok(!input.cycles.some((c) => c.startDate === '2026-01-31'), '92-day span is a logging gap, not a cycle window')
  assert.ok(input.observations.some((o) => o.date === '2026-03-01'), 'the observation inside the gap is still passed; the engine ignores it as outside every window')
})

// ---------------------------------------------------------------------------
// Pattern engine invocation and response
// ---------------------------------------------------------------------------

test('patterns come from assessAllPatterns over the built input; only non-none tiers; engine order; evidence traceable; no causal language', async () => {
  const { events, observations } = regularFixture()
  const f = fakes({ events, observations })
  const you = await f.service.getYou(DB, AS_OF)

  const input = buildPatternInput(buildCycleSummaries(events, AS_OF), observations, you.stats.typicalLength, AS_OF)
  const expected = pattern.assessAllPatterns(input).filter((a) => a.tier !== 'none')
  assert.deepEqual(you.patterns, expected)
  assert.ok(you.patterns.length >= 2)
  // Engine order: tier ↓, consistency ↓, key ↑ — all five are established at consistency 1, so alphabetical by key.
  assert.deepEqual(you.patterns.map((p) => [p.target.kind, p.target.key, p.tier]), [
    ['symptom', 'cramps', 'established'],
    ['symptom', 'fatigue', 'established'],
    ['mood', 'high', 'established'],
    ['mood', 'low', 'established'],
    ['mood', 'neutral', 'established'],
  ])
  for (const p of you.patterns) {
    assert.ok(shared.CONFIDENCE_TIERS.includes(p.tier) && p.tier !== 'none')
    assert.ok(!CAUSAL.test(p.summary), p.summary)
    for (const c of p.caveats) assert.ok(!CAUSAL.test(c), c)
    for (const row of p.evidence) {
      for (const date of row.observedOn) {
        assert.ok(observations.some((o) => o.date === date && (p.target.kind === 'symptom' ? o.symptoms.includes(p.target.key) : pattern.moodBucketFor(o.mood) === p.target.key)), `${date} traces to a logged observation`)
      }
    }
  }
  // 'high' mood appears in every cycle on day 9 (follicular) → established too; 'neutral' on day 21 → established. Nothing is 'none'.
  assert.ok(!you.patterns.some((p) => p.tier === 'none'))
})

// ---------------------------------------------------------------------------
// Evidence synchronisation
// ---------------------------------------------------------------------------

test('first computation: all non-none assessments upserted in one call with injected computedAt and cycle-bounded range; nothing deleted', async () => {
  const { events, observations } = regularFixture()
  const f = fakes({ events, observations })
  const you = await f.service.getYou(DB, AS_OF)
  const upsert = f.calls.find(([n]) => n === 'evidence.upsertMany')
  assert.ok(upsert)
  assert.deepEqual(upsert[2], you.patterns)
  assert.deepEqual(upsert[3], { rangeStart: '2026-01-05', rangeEnd: '2026-05-24', computedAt: NOW.toISOString() })
  assert.ok(!f.names().includes('evidence.deleteForPattern'))
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'evidence.list', 'evidence.upsertMany'])
})

test('repeated identical computation: no upsert, no delete (computed_at is not refreshed on read)', async () => {
  const { events, observations } = regularFixture()
  const first = fakes({ events, observations })
  const you = await first.service.getYou(DB, AS_OF)
  const meta = first.calls.find(([n]) => n === 'evidence.upsertMany')[3]
  // Stored rows as the repository would return them — including jsonb key reordering.
  const stored = you.patterns.map((a, i) => {
    const rec = storedFrom(a, { rangeStart: meta.rangeStart, rangeEnd: meta.rangeEnd, id: `p-${i}` })
    rec.evidence = rec.evidence.map((row) => Object.fromEntries(Object.entries(row).reverse()))
    return rec
  })
  const second = fakes({ events, observations, stored, now: () => new Date('2026-09-14T09:00:00Z') })
  const again = await second.service.getYou(DB, AS_OF)
  assert.deepEqual(again, you)
  assert.deepEqual(second.names(), ['settings.get', 'events.list', 'observations.list', 'evidence.list'])
})

test('changed evidence: only the changed pattern is upserted; unchanged ones are untouched', async () => {
  const { events, observations } = regularFixture()
  const base = fakes({ events, observations })
  const you = await base.service.getYou(DB, AS_OF)
  const meta = base.calls.find(([n]) => n === 'evidence.upsertMany')[3]
  const stored = you.patterns.map((a, i) => storedFrom(a, { rangeStart: meta.rangeStart, rangeEnd: meta.rangeEnd, id: `p-${i}` }))
  stored[0] = { ...stored[0], confidenceTier: 'emerging', supportingCycles: 2, consistency: 0.4 } // stale cramps row
  const f = fakes({ events, observations, stored })
  await f.service.getYou(DB, AS_OF)
  const upsert = f.calls.find(([n]) => n === 'evidence.upsertMany')
  assert.deepEqual(upsert[2].map((a) => a.target), [you.patterns[0].target])
  assert.equal(upsert[3].computedAt, NOW.toISOString())
  assert.ok(!f.names().includes('evidence.deleteForPattern'))
  assert.deepEqual([...EVIDENCE_COMPARE_KEYS], ['phase', 'confidenceTier', 'supportingCycles', 'assessableCycles', 'consistency', 'evidence', 'rangeStart', 'rangeEnd'])
})

test('stale evidence: stored patterns the engine now scores none are deleted; non-none stored patterns are kept', async () => {
  const { events, observations } = regularFixture()
  const base = fakes({ events, observations })
  const you = await base.service.getYou(DB, AS_OF)
  const meta = base.calls.find(([n]) => n === 'evidence.upsertMany')[3]
  const keep = storedFrom(you.patterns[0], { rangeStart: meta.rangeStart, rangeEnd: meta.rangeEnd, id: 'keep' })
  const stored = [
    keep,
    // headache: never observed now → engine assesses explicitly → none → delete
    { ...keep, id: 'stale-1', patternType: 'symptom', signal: 'headache', phase: 'follicular', confidenceTier: 'likely' },
    // bloating: observed in exactly one cycle → present in results with tier none → delete
    { ...keep, id: 'stale-2', patternType: 'symptom', signal: 'bloating', confidenceTier: 'emerging' },
    // a key that is no longer in the vocabulary cannot be current evidence → delete
    { ...keep, id: 'stale-3', patternType: 'symptom', signal: 'unicorns', confidenceTier: 'emerging' },
  ]
  const f = fakes({ events, observations: [...observations, obsOf(addDays(REGULAR[0], 21), { symptoms: ['bloating'] })], stored })
  await f.service.getYou(DB, AS_OF)
  const deletes = f.calls.filter(([n]) => n === 'evidence.deleteForPattern').map(([, , type, signal]) => `${type}:${signal}`)
  assert.deepEqual(deletes.sort(), ['symptom:bloating', 'symptom:headache', 'symptom:unicorns'])
  assert.ok(!deletes.includes('symptom:cramps'), 'current established pattern kept')
})

test('a stored pattern that is currently supported is never deleted even when other data is thin', async () => {
  // Only two completed cycles → cramps is 'emerging' (not none) → stored row must survive.
  const starts = startsFrom('2026-03-02', [28, 28])
  const events = starts.map((d) => eventOf(d))
  const observations = starts.slice(0, 2).flatMap((d) => [obsOf(addDays(d, 20), { symptoms: ['cramps'] }), ...[1, 3, 5, 7, 9].map((n) => obsOf(addDays(d, n), { energy: 2 }))])
  const base = await fakes({ events, observations }).service.getYou(DB, AS_OF)
  assert.equal(base.patterns[0].tier, 'emerging')
  const stored = [storedFrom(base.patterns[0], { rangeStart: '2026-03-02', rangeEnd: '2026-04-26' })]
  const f = fakes({ events, observations, stored })
  await f.service.getYou(DB, AS_OF)
  assert.deepEqual(f.names(), ['settings.get', 'events.list', 'observations.list', 'evidence.list'])
})

// ---------------------------------------------------------------------------
// Dates, determinism, errors, purity
// ---------------------------------------------------------------------------

test('computedAt comes from the injected server clock (or the per-call override) and is independent of asOfDate', async () => {
  const { events, observations } = regularFixture()
  const f = fakes({ events, observations, now: () => new Date('2027-01-01T00:00:00.000Z') })
  await f.service.getYou(DB, AS_OF)
  assert.equal(f.calls.find(([n]) => n === 'evidence.upsertMany')[3].computedAt, '2027-01-01T00:00:00.000Z')

  const g = fakes({ events, observations })
  await g.service.getYou(DB, AS_OF, { computedAt: '2026-06-01T23:59:59.000Z' })
  assert.equal(g.calls.find(([n]) => n === 'evidence.upsertMany')[3].computedAt, '2026-06-01T23:59:59.000Z')

  // Same clock, different asOfDate → different current cycle, same computedAt.
  const h = fakes({ events, observations })
  const early = await h.service.getYou(DB, '2026-04-01')
  assert.equal(early.cycles[0].startDate, '2026-03-30')
  assert.equal(early.cycles[0].isCurrent, true)
  assert.equal(h.calls.find(([n]) => n === 'evidence.upsertMany')[3].computedAt, NOW.toISOString())
})

test('deterministic: same rows + asOfDate + clock → identical snapshot and identical write sequence', async () => {
  const { events, observations } = regularFixture()
  const a = fakes({ events, observations })
  const b = fakes({ events, observations })
  assert.deepEqual(await a.service.getYou(DB, AS_OF), await b.service.getYou(DB, AS_OF))
  assert.deepEqual(a.calls, b.calls)
})

test('repository errors propagate unchanged and stop the pipeline', async () => {
  const pgError = { code: '42501', message: 'rls' }
  const { events, observations } = regularFixture()
  const f = fakes({ events, observations })
  f.service = createYouService({
    cycleSettings: { get: async () => null },
    cycleEvents: { list: async () => events },
    observations: { list: async () => observations },
    patternEvidence: { list: async () => { throw pgError }, upsertMany: async () => assert.fail('no write after a failed read'), deleteForPattern: async () => assert.fail('no delete after a failed read') },
  })
  await assert.rejects(f.service.getYou(DB, AS_OF), (e) => e === pgError)
})

test('stableStringify ignores key order but not values', () => {
  assert.equal(stableStringify({ b: [1, { d: 2, c: 3 }], a: null }), stableStringify({ a: null, b: [1, { c: 3, d: 2 }] }))
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }))
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]))
})

test('service source: no AI, no service role, no HTTP, no identity, clock only through the injectable default', () => {
  const source = readFileSync(new URL('../src/services/youService.js', import.meta.url), 'utf8')
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const forbidden of ['createServiceClient', 'SERVICE_ROLE', 'lib/supabase', 'req.', 'res.', 'Date.now', 'fetch(', 'process.env', 'user_id', 'userId', 'anthropic', 'openai', 'prompt']) {
    assert.ok(!code.includes(forbidden), `contains "${forbidden}"`)
  }
  assert.equal((code.match(/new Date\(/g) ?? []).length, 1, 'the only Date construction is the injectable default clock')
  assert.ok(!code.includes('.sqrt') && !code.includes('median'), 'no second statistics implementation')
})
