import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as pattern from '../src/engines/patternConfidence.js'
import * as shared from '../../shared/constants.ts'

// ---------------------------------------------------------------------------
// Fixture helpers (tests may use Date; the engine may not)
// ---------------------------------------------------------------------------

const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/** N consecutive 28-day cycles starting 2026-01-01. */
const starts = (n) => Array.from({ length: n }, (_, i) => addDays('2026-01-01', i * 28))

/**
 * Completed cycles for the given start dates. `logged` may be a number or a per-cycle array.
 * `open: true` leaves the last cycle in progress (endDate null).
 */
function cycles(startDates, { logged = 20, open = false, length = 28 } = {}) {
  return startDates.map((startDate, i) => {
    const isLast = i === startDates.length - 1
    const endDate = !isLast ? addDays(startDates[i + 1], -1) : open ? null : addDays(startDate, length - 1)
    return {
      index: i,
      startDate,
      endDate,
      typicalLength: length,
      loggedDays: Array.isArray(logged) ? logged[i] : logged,
    }
  })
}

/** Observation on 1-based cycle `day` of the cycle that starts on `start`. Phases (L=28, P=5): 1–5 menstrual, 6–12 follicular, 13–15 ovulatory, 16–28 luteal. */
const on = (start, day, key, kind = 'symptom') => ({ date: addDays(start, day - 1), kind, key })

const CRAMPS = { kind: 'symptom', key: 'cramps' }
const CAUSAL = /\b(cause|causes|caused|because|due to|leads? to|triggers?|results? in|makes you|explains?)\b/i

function assertNonCausal(assessment) {
  assert.ok(!CAUSAL.test(assessment.summary), `causal summary: ${assessment.summary}`)
  for (const caveat of assessment.caveats) assert.ok(!CAUSAL.test(caveat), `causal caveat: ${caveat}`)
}

function assertTraceable(input, assessment) {
  assert.equal(assessment.evidence.length, input.cycles.length, 'one evidence row per cycle')
  assessment.evidence.forEach((row, i) => {
    assert.equal(row.cycleIndex, input.cycles[i].index)
    assert.equal(row.cycleStart, input.cycles[i].startDate)
    assert.equal(row.observedOn.length, row.cycleDays.length)
    for (const date of row.observedOn) {
      assert.ok(
        input.observations.some((o) => o.date === date && o.kind === assessment.target.kind && o.key === assessment.target.key),
        `evidence date ${date} traces to a logged observation`,
      )
    }
    assert.deepEqual([...row.observedOn].sort(), row.observedOn, 'observedOn ascending')
    assert.equal(new Set(row.observedOn).size, row.observedOn.length, 'observedOn deduplicated')
    if (row.sparse) assert.equal(row.supports, false, 'sparse never supports')
  })
  assert.equal(assessment.evidence.filter((r) => r.supports).length, assessment.supportingCycles)
  assert.equal(assessment.evidence.filter((r) => r.sparse).length, assessment.sparseCycles)
  assert.equal(assessment.totalCycles, assessment.assessableCycles + assessment.sparseCycles)
}

// ---------------------------------------------------------------------------
// Cycle counts and thresholds
// ---------------------------------------------------------------------------

test('no cycles → none, empty evidence, zero consistency', () => {
  const input = deepFreeze({ observations: [{ date: '2026-01-10', kind: 'symptom', key: 'cramps' }], cycles: [] })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.deepEqual(a, {
    target: CRAMPS,
    tier: 'none',
    totalCycles: 0,
    assessableCycles: 0,
    supportingCycles: 0,
    sparseCycles: 0,
    consistency: 0,
    dominantPhase: null,
    evidence: [],
    summary: pattern.SUMMARY_TEMPLATES.none.replace('{label}', 'Cramps'),
    caveats: [pattern.CAVEATS.fewCycles(0)],
  })
})

test('one cycle → evidence is recorded but tier is none and no dominant phase is claimed', () => {
  const [s0] = starts(1)
  const input = deepFreeze({ observations: [on(s0, 21, 'cramps')], cycles: cycles(starts(1)) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.tier, 'none')
  assert.equal(a.assessableCycles, 1)
  assert.equal(a.supportingCycles, 1)
  assert.equal(a.consistency, 1)
  assert.equal(a.dominantPhase, null)
  assert.deepEqual(a.evidence[0], {
    cycleIndex: 0, cycleStart: s0, observedOn: [addDays(s0, 20)], cycleDays: [21], phase: 'luteal', supports: true, sparse: false,
  })
  assertTraceable(input, a)
})

test('insufficient cycles: one supporting cycle out of two is none', () => {
  const [s0] = starts(2)
  const input = deepFreeze({ observations: [on(s0, 21, 'cramps')], cycles: cycles(starts(2)) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.tier, 'none')
  assert.equal(a.supportingCycles, 1)
  assert.equal(a.consistency, 0.5)
})

test('exactly the emerging threshold: 2 supporting of 4 (0.5), and 2 of 2', () => {
  const s = starts(4)
  const twoOfFour = deepFreeze({ observations: [on(s[0], 21, 'cramps'), on(s[2], 22, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(twoOfFour, CRAMPS)
  assert.equal(a.tier, 'emerging')
  assert.equal(a.supportingCycles, 2)
  assert.equal(a.assessableCycles, 4)
  assert.equal(a.consistency, 0.5)
  assert.equal(a.dominantPhase, 'luteal')
  assert.equal(a.summary, 'Cramps was logged during the luteal phase in 2 of 4 tracked cycles.')
  assert.deepEqual(a.caveats, [pattern.CAVEATS.fewCycles(4), pattern.CAVEATS.early, pattern.CAVEATS.notCausal('Cramps')])
  assertTraceable(twoOfFour, a)

  const s2 = starts(2)
  const twoOfTwo = deepFreeze({ observations: [on(s2[0], 20, 'cramps'), on(s2[1], 20, 'cramps')], cycles: cycles(s2) })
  assert.equal(pattern.assessPattern(twoOfTwo, CRAMPS).tier, 'emerging', 'consistency 1 but only 2 supporting')
})

test('exactly the likely threshold: 3 of 5 (0.6), and 3 of 3', () => {
  const s = starts(5)
  const threeOfFive = deepFreeze({ observations: [on(s[0], 20, 'cramps'), on(s[1], 21, 'cramps'), on(s[4], 19, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(threeOfFive, CRAMPS)
  assert.equal(a.tier, 'likely')
  assert.equal(a.consistency, 0.6)
  assert.equal(a.summary, 'Cramps has shown up during the luteal phase in 3 of 5 tracked cycles.')
  assert.deepEqual(a.caveats, [pattern.CAVEATS.notCausal('Cramps')])

  const s3 = starts(3)
  const threeOfThree = deepFreeze({ observations: s3.map((st) => on(st, 20, 'cramps')), cycles: cycles(s3) })
  const b = pattern.assessPattern(threeOfThree, CRAMPS)
  assert.equal(b.tier, 'likely', 'consistency 1 but only 3 supporting')
  assert.deepEqual(b.caveats, [pattern.CAVEATS.fewCycles(3), pattern.CAVEATS.notCausal('Cramps')])
})

test('exactly the established threshold: 5 of 5, 6 of 8 (0.75); 4 of 5 stays likely', () => {
  const s5 = starts(5)
  const fiveOfFive = deepFreeze({ observations: s5.map((st) => on(st, 20, 'cramps')), cycles: cycles(s5) })
  const a = pattern.assessPattern(fiveOfFive, CRAMPS)
  assert.equal(a.tier, 'established')
  assert.equal(a.consistency, 1)
  assert.equal(a.summary, 'Cramps has consistently been logged during the luteal phase — 5 of 5 tracked cycles.')
  assert.deepEqual(a.caveats, [pattern.CAVEATS.notCausal('Cramps')])

  const s8 = starts(8)
  const sixOfEight = deepFreeze({ observations: [0, 1, 3, 4, 6, 7].map((i) => on(s8[i], 20, 'cramps')), cycles: cycles(s8) })
  assert.equal(pattern.assessPattern(sixOfEight, CRAMPS).tier, 'established')
  assert.equal(pattern.assessPattern(sixOfEight, CRAMPS).consistency, 0.75)

  const fourOfFive = deepFreeze({ observations: [0, 1, 2, 3].map((i) => on(s5[i], 20, 'cramps')), cycles: cycles(s5) })
  const c = pattern.assessPattern(fourOfFive, CRAMPS)
  assert.equal(c.tier, 'likely', '0.8 consistency but only 4 supporting')
  assert.equal(c.consistency, 0.8)
})

test('consistency is rounded to 3 decimals; tier uses the exact ratio', () => {
  const s = starts(3)
  const input = deepFreeze({ observations: [on(s[0], 20, 'cramps'), on(s[1], 20, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.consistency, 0.667)
  assert.equal(a.tier, 'emerging')
})

// ---------------------------------------------------------------------------
// Phase concentration and evidence shape
// ---------------------------------------------------------------------------

test('repeated symptom in the same phase across cycles: multi-day evidence rows', () => {
  const s = starts(3)
  const input = deepFreeze({
    observations: [on(s[0], 20, 'cramps'), on(s[0], 21, 'cramps'), on(s[1], 22, 'cramps'), on(s[2], 19, 'cramps'), on(s[2], 20, 'cramps'), on(s[2], 21, 'cramps')],
    cycles: cycles(s),
  })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.tier, 'likely')
  assert.equal(a.dominantPhase, 'luteal')
  assert.deepEqual(a.evidence.map((r) => r.cycleDays), [[20, 21], [22], [19, 20, 21]])
  assert.ok(a.evidence.every((r) => r.phase === 'luteal' && r.supports))
  assertTraceable(input, a)
})

test('symptom scattered across phases: no dominant phase, none, scattered caveat', () => {
  const s = starts(3)
  const input = deepFreeze({ observations: [on(s[0], 20, 'cramps'), on(s[1], 8, 'cramps'), on(s[2], 2, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.tier, 'none')
  assert.equal(a.dominantPhase, null)
  assert.equal(a.supportingCycles, 0)
  assert.equal(a.consistency, 0)
  assert.deepEqual(a.evidence.map((r) => r.phase), ['luteal', 'follicular', 'menstrual'])
  assert.ok(a.evidence.every((r) => !r.supports))
  assert.ok(a.caveats.includes(pattern.CAVEATS.scattered('Cramps', 3)))

  // An exact two-way tie is also "no concentration".
  const s4 = starts(4)
  const tie = deepFreeze({ observations: [on(s4[0], 20, 'cramps'), on(s4[1], 20, 'cramps'), on(s4[2], 8, 'cramps'), on(s4[3], 8, 'cramps')], cycles: cycles(s4) })
  assert.equal(pattern.assessPattern(tie, CRAMPS).dominantPhase, null)
  assert.equal(pattern.assessPattern(tie, CRAMPS).tier, 'none')
})

test('a cycle whose observations span phases has phase null but still supports the dominant phase', () => {
  const s = starts(3)
  const input = deepFreeze({
    observations: [on(s[0], 20, 'cramps'), on(s[1], 20, 'cramps'), on(s[2], 3, 'cramps'), on(s[2], 24, 'cramps')],
    cycles: cycles(s),
  })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.dominantPhase, 'luteal')
  assert.equal(a.supportingCycles, 3)
  assert.equal(a.evidence[2].phase, null)
  assert.equal(a.evidence[2].supports, true)
  assert.deepEqual(a.evidence[2].cycleDays, [3, 24])
})

test('observations outside every cycle window are ignored', () => {
  const s = starts(2)
  const input = deepFreeze({
    observations: [on(s[0], 20, 'cramps'), { date: '2025-12-20', kind: 'symptom', key: 'cramps' }, { date: '2026-12-01', kind: 'symptom', key: 'cramps' }],
    cycles: cycles(s),
  })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.evidence.flatMap((r) => r.observedOn).length, 1)
})

// ---------------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------------

test('mood buckets: 1–2 low, 3 neutral, 4–5 high; anything else rejected', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(pattern.moodBucketFor), ['low', 'low', 'neutral', 'high', 'high'])
  for (const bad of [0, 6, 2.5, '3', null, undefined]) {
    assert.throws(() => pattern.moodBucketFor(bad), (e) => e.code === 'invalid_input')
  }
  assert.deepEqual([...pattern.MOOD_BUCKETS], ['low', 'neutral', 'high'])
})

test('mood pattern: low mood in the luteal phase across cycles', () => {
  const s = starts(3)
  const input = deepFreeze({ observations: s.map((st) => on(st, 24, pattern.moodBucketFor(2), 'mood')), cycles: cycles(s) })
  const a = pattern.assessPattern(input, { kind: 'mood', key: 'low' })
  assert.equal(a.tier, 'likely')
  assert.equal(a.dominantPhase, 'luteal')
  assert.equal(a.summary, 'Low mood has shown up during the luteal phase in 3 of 3 tracked cycles.')
  assertNonCausal(a)
  assertTraceable(input, a)

  const high = pattern.assessPattern(
    deepFreeze({ observations: s.map((st) => on(st, 9, 'high', 'mood')), cycles: cycles(s) }),
    { kind: 'mood', key: 'high' },
  )
  assert.equal(high.dominantPhase, 'follicular')
  assert.match(high.summary, /^Good mood /)
})

// ---------------------------------------------------------------------------
// Missing data semantics
// ---------------------------------------------------------------------------

test('sparse cycle: excluded from the denominator, never counted against, observations still listed', () => {
  const s = starts(3)
  const input = deepFreeze({
    observations: [on(s[0], 20, 'cramps'), on(s[1], 20, 'cramps'), on(s[2], 20, 'cramps')],
    cycles: cycles(s, { logged: [20, 20, 3] }),
  })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.totalCycles, 3)
  assert.equal(a.assessableCycles, 2)
  assert.equal(a.sparseCycles, 1)
  assert.equal(a.supportingCycles, 2)
  assert.equal(a.consistency, 1)
  assert.equal(a.tier, 'emerging')
  assert.deepEqual(a.evidence[2], {
    cycleIndex: 2, cycleStart: s[2], observedOn: [addDays(s[2], 19)], cycleDays: [20], phase: 'luteal', supports: false, sparse: true,
  })
  assert.ok(a.caveats.includes(pattern.CAVEATS.sparse(1)))
  assertTraceable(input, a)

  // A sparse cycle WITHOUT the symptom must not lower consistency either.
  const noSymptom = deepFreeze({ observations: [on(s[0], 20, 'cramps'), on(s[1], 20, 'cramps')], cycles: cycles(s, { logged: [20, 20, 2] }) })
  assert.equal(pattern.assessPattern(noSymptom, CRAMPS).consistency, 1)
  assert.equal(pattern.MIN_LOGGED_DAYS_PER_CYCLE, 5)
  const boundary = deepFreeze({ observations: [], cycles: cycles(s, { logged: [5, 4, 20] }) })
  assert.deepEqual(pattern.assessPattern(boundary, CRAMPS).evidence.map((r) => r.sparse), [false, true, false])
})

test('in-progress cycle is not assessed until it completes', () => {
  const s = starts(3)
  const input = deepFreeze({ observations: s.map((st) => on(st, 20, 'cramps')), cycles: cycles(s, { open: true }) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.assessableCycles, 2)
  assert.equal(a.sparseCycles, 1)
  assert.equal(a.evidence[2].sparse, true)
  assert.equal(a.evidence[2].supports, false)
  assert.deepEqual(a.evidence[2].observedOn, [addDays(s[2], 19)], 'still traceable')
  assert.ok(a.caveats.includes(pattern.CAVEATS.inProgress))
  assert.ok(!a.caveats.includes(pattern.CAVEATS.sparse(1)), 'in-progress is not reported as low logging')
})

test('a well-logged cycle without the target counts against the pattern (that is the only kind that can)', () => {
  const s = starts(4)
  const input = deepFreeze({ observations: [on(s[0], 20, 'cramps'), on(s[1], 20, 'cramps'), on(s[2], 20, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.assessableCycles, 4)
  assert.equal(a.supportingCycles, 3)
  assert.equal(a.consistency, 0.75)
  assert.equal(a.tier, 'likely')
  assert.deepEqual(a.evidence[3], { cycleIndex: 3, cycleStart: s[3], observedOn: [], cycleDays: [], phase: null, supports: false, sparse: false })
})

test('duplicate observation dates collapse to one evidence entry', () => {
  const s = starts(2)
  const dup = on(s[0], 20, 'cramps')
  const input = deepFreeze({ observations: [dup, { ...dup }, { ...dup, intensity: 4 }, on(s[1], 20, 'cramps')], cycles: cycles(s) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.deepEqual(a.evidence[0].observedOn, [dup.date])
  assert.deepEqual(a.evidence[0].cycleDays, [20])
  assert.equal(a.supportingCycles, 2)
})

test('empty observations → none for any target, and assessAllPatterns returns []', () => {
  const input = deepFreeze({ observations: [], cycles: cycles(starts(5)) })
  const a = pattern.assessPattern(input, CRAMPS)
  assert.equal(a.tier, 'none')
  assert.equal(a.assessableCycles, 5)
  assert.ok(a.evidence.every((r) => r.observedOn.length === 0 && !r.supports && !r.sparse))
  assert.deepEqual(pattern.assessAllPatterns(input), [])
})

// ---------------------------------------------------------------------------
// assessAllPatterns
// ---------------------------------------------------------------------------

test('assessAllPatterns: every present supported target, sorted, filtered by minTier, unknown keys ignored', () => {
  const s = starts(5)
  const input = deepFreeze({
    observations: [
      ...s.map((st) => on(st, 20, 'cramps')), // 5/5 luteal → established
      on(s[0], 8, 'headache'), on(s[2], 9, 'headache'), on(s[3], 7, 'headache'), // 3/5 follicular → likely
      on(s[1], 3, 'bloating'), // 1/5 → none
      ...s.map((st) => on(st, 21, 'low', 'mood')), // 5/5 luteal → established
      on(s[0], 10, 'unicorns'), // not in vocabulary → ignored
      { date: addDays(s[0], 10), kind: 'mood', key: 'meh' }, // not a bucket → ignored
    ],
    cycles: cycles(s),
  })
  const all = pattern.assessAllPatterns(input)
  assert.deepEqual(
    all.map((a) => [a.target.kind, a.target.key, a.tier]),
    [['symptom', 'cramps', 'established'], ['mood', 'low', 'established'], ['symptom', 'headache', 'likely'], ['symptom', 'bloating', 'none']],
  )
  assert.deepEqual(pattern.assessAllPatterns(input, { minTier: 'emerging' }).map((a) => a.target.key), ['cramps', 'low', 'headache'])
  assert.deepEqual(pattern.assessAllPatterns(input, { minTier: 'established' }).map((a) => a.target.key), ['cramps', 'low'])
  for (const a of all) {
    assert.deepEqual(a, pattern.assessPattern(input, a.target), 'built from assessPattern')
    assertNonCausal(a)
    assertTraceable(input, a)
  }
})

test('assessAllPatterns: order is independent of observation order', () => {
  const s = starts(5)
  const observations = [...s.map((st) => on(st, 20, 'cramps')), on(s[0], 8, 'headache'), on(s[2], 9, 'headache'), ...s.map((st) => on(st, 21, 'low', 'mood'))]
  const forward = pattern.assessAllPatterns(deepFreeze({ observations, cycles: cycles(s) }))
  const reversed = pattern.assessAllPatterns(deepFreeze({ observations: [...observations].reverse(), cycles: cycles(s) }))
  assert.deepEqual(forward, reversed)
})

// ---------------------------------------------------------------------------
// Language, constants, determinism, validation
// ---------------------------------------------------------------------------

test('no causal language in any template or caveat', () => {
  for (const sentence of Object.values(pattern.SUMMARY_TEMPLATES)) assert.ok(!CAUSAL.test(sentence), sentence)
  for (const caveat of Object.values(pattern.CAVEATS)) {
    const text = typeof caveat === 'function' ? caveat('Cramps', 3) : caveat
    assert.ok(!CAUSAL.test(text), text)
  }
  const tiers = Object.entries(pattern.TIER_THRESHOLDS)
  assert.deepEqual(tiers.map(([name]) => name), ['emerging', 'likely', 'established'])
  for (let i = 1; i < tiers.length; i += 1) {
    assert.ok(tiers[i][1].minSupportingCycles >= tiers[i - 1][1].minSupportingCycles)
    assert.ok(tiers[i][1].minConsistency >= tiers[i - 1][1].minConsistency)
  }
})

test('symptom vocabulary is pinned to shared/constants.ts; supported targets are the 3 buckets + vocabulary', () => {
  assert.deepEqual([...pattern.SYMPTOM_KEYS], [...shared.SYMPTOMS])
  assert.equal(pattern.SUPPORTED_TARGETS.length, shared.SYMPTOMS.length + 3)
  for (const target of pattern.SUPPORTED_TARGETS) assert.ok(shared.OBSERVATION_KINDS.includes(target.kind))
  for (const tier of ['none', ...Object.keys(pattern.TIER_THRESHOLDS)]) assert.ok(shared.CONFIDENCE_TIERS.includes(tier))
})

test('deterministic repeat calls and input immutability', () => {
  const s = starts(4)
  const input = {
    observations: [on(s[2], 20, 'cramps'), on(s[0], 21, 'cramps'), on(s[0], 21, 'cramps'), on(s[1], 3, 'low', 'mood')],
    cycles: cycles(s, { logged: [20, 3, 20, 20], open: true }),
  }
  const before = JSON.stringify(input)
  const a1 = pattern.assessPattern(input, CRAMPS)
  const a2 = pattern.assessPattern(input, CRAMPS)
  const all1 = pattern.assessAllPatterns(input)
  const all2 = pattern.assessAllPatterns(input)
  assert.equal(JSON.stringify(input), before, 'input untouched')
  assert.deepEqual(a1, a2)
  assert.deepEqual(all1, all2)
  assert.notEqual(a1, a2)
  assert.notEqual(a1.evidence, a2.evidence)
  assert.deepEqual(pattern.assessPattern(deepFreeze(structuredClone(input)), CRAMPS), a1, 'frozen input gives the same result')
})

test('invalid targets and impossible cycle states are rejected', () => {
  const s = starts(2)
  const valid = deepFreeze({ observations: [], cycles: cycles(s) })
  const rejects = (fn) => assert.throws(fn, (e) => e.name === 'PatternEngineError' && e.code === 'invalid_input')

  rejects(() => pattern.assessPattern(valid, { kind: 'symptom', key: 'unicorns' }))
  rejects(() => pattern.assessPattern(valid, { kind: 'mood', key: 'meh' }))
  rejects(() => pattern.assessPattern(valid, { kind: 'vibe', key: 'cramps' }))
  rejects(() => pattern.assessPattern(valid, { kind: 'mood', key: 3 }))
  rejects(() => pattern.assessAllPatterns(valid, { minTier: 'certain' }))

  rejects(() => pattern.assessPattern({ observations: [{ date: 'x', kind: 'mood', key: 'low' }], cycles: [] }, CRAMPS))
  rejects(() => pattern.assessPattern({ observations: [], cycles: [...cycles(s)].reverse().map((c, i) => ({ ...c, index: i })) }, CRAMPS))
  rejects(() => pattern.assessPattern({ observations: [], cycles: [{ ...cycles(s)[0], endDate: null }, cycles(s)[1]] }, CRAMPS))
  rejects(() => pattern.assessPattern({ observations: [], cycles: [{ ...cycles(s)[0], endDate: '2025-12-31' }] }, CRAMPS))
  rejects(() => pattern.assessPattern({ observations: [], cycles: [cycles(s)[0], { ...cycles(s)[1], startDate: cycles(s)[0].endDate }] }, CRAMPS))
})
