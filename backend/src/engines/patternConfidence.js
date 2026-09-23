/**
 * Pattern Confidence engine — PURE and DETERMINISTIC.
 *
 * Answers one question: "How reliably has this symptom or mood recurred at the
 * same point in this user's cycles?" It counts recurrences; it does not explain them.
 *
 * Invariants (hold for every export):
 *   - No I/O, no LLM, no clock, no randomness. Never imports Supabase.
 *   - Same input → same output. Inputs are never mutated.
 *   - Output is CORRELATIONAL ONLY. No field or string may claim that the cycle
 *     causes the observation. `summary` is built only from the templates in
 *     `SUMMARY_TEMPLATES`, which describe what was logged, not why.
 *   - Every tier is backed by user-visible `evidence` — each supporting cycle and
 *     the dates the observation was logged — so the user can check the claim.
 *   - Missing data lowers confidence; it is never treated as "did not occur".
 *     A day with no log is not evidence of absence, and a cycle with too few
 *     logged days (or one still in progress) is not counted either way.
 *
 * Cycle vocabulary used throughout:
 *   assessable  — completed cycle (endDate set) with ≥ MIN_LOGGED_DAYS_PER_CYCLE
 *                 logged days. Only assessable cycles can count for OR against a pattern.
 *   sparse      — not assessable: fewer logged days than the minimum, or still in
 *                 progress. Its observations are still listed in `evidence` for
 *                 traceability, but it never moves the numbers.
 *   supporting  — assessable cycle in which the target was logged at least once
 *                 during the dominant phase (see `dominantPhaseOf`).
 *
 * Phase placement reuses cycle.js's band model (the only phase model in the
 * codebase), driven by each CycleWindow's `typicalLength`. Callers should pass
 * the cycle's actual length for completed cycles.
 */

import { DEFAULT_PERIOD_LENGTH, daysBetween, phaseForCycleDay } from './cycle.js'

/** @typedef {import('./cycle.js').ISODate} ISODate */
/** @typedef {'menstrual' | 'follicular' | 'ovulatory' | 'luteal'} EvidencePhase */

/** @typedef {'symptom' | 'mood'} ObservationKind */

/** @typedef {'none' | 'emerging' | 'likely' | 'established'} ConfidenceTier */

/** @typedef {'low' | 'neutral' | 'high'} MoodBucket */

/**
 * @typedef {Object} Observation
 * @property {ISODate} date
 * @property {ObservationKind} kind
 * @property {string} key          For symptoms: a SYMPTOM_KEYS value. For moods: a MOOD_BUCKETS value
 *                                 (the orchestration layer maps 1–5 with `moodBucketFor`).
 * @property {number} [intensity]  Optional 1–5; recorded but not used by this version of the model.
 */

/**
 * @typedef {Object} CycleWindow
 * A completed or in-progress cycle, as delimited by period start dates.
 * @property {number} index              0 = oldest cycle supplied
 * @property {ISODate} startDate
 * @property {ISODate|null} endDate      Day before the next period start; null for the current cycle
 * @property {number} typicalLength      Cycle length used to derive phase boundaries. Pass the actual
 *                                       length (endDate − startDate + 1) for completed cycles.
 * @property {number} loggedDays         Distinct days in this window on which the user logged anything at all.
 *                                       Drives the sparse check.
 */

/**
 * @typedef {Object} PatternTarget
 * @property {ObservationKind} kind
 * @property {string} key   A SYMPTOM_KEYS value for 'symptom', a MOOD_BUCKETS value for 'mood'
 */

/**
 * @typedef {Object} PatternInput
 * @property {Observation[]} observations   Any order; observations outside every window are ignored
 * @property {CycleWindow[]} cycles         Ascending by `startDate`, non-overlapping; only the last may have
 *                                          endDate null. May be empty.
 */

/**
 * @typedef {Object} CycleEvidence
 * One row the UI can render: "Cycle starting 12 Jul — logged on days 22, 23 (luteal)".
 * @property {number} cycleIndex
 * @property {ISODate} cycleStart
 * @property {ISODate[]} observedOn      Dates the target was logged in this cycle, ascending, deduplicated
 * @property {number[]} cycleDays        1-based cycle day of each `observedOn` entry
 * @property {EvidencePhase|null} phase  Phase shared by all observations in the cycle; null if they span
 *                                       phases, fall outside the band model, or there are none
 * @property {boolean} supports          True when this cycle counts toward `supportingCycles`
 * @property {boolean} sparse            True when the cycle is not assessable (too few logged days, or in progress)
 */

/**
 * @typedef {Object} PatternAssessment
 * @property {PatternTarget} target
 * @property {ConfidenceTier} tier
 * @property {number} totalCycles        `cycles.length`
 * @property {number} assessableCycles   Completed cycles with enough logged days to count either way
 * @property {number} supportingCycles   Assessable cycles in which the target was logged in the dominant phase
 * @property {number} sparseCycles       Cycles excluded for missing data (never counted against the pattern)
 * @property {number} consistency        supportingCycles / assessableCycles rounded to 3 dp, 0 when assessableCycles is 0
 * @property {EvidencePhase|null} dominantPhase  Phase the supporting evidence concentrates in; null when tier is 'none'
 * @property {CycleEvidence[]} evidence  One entry per cycle, oldest → newest, including non-supporting ones
 * @property {string} summary            Non-causal sentence built from SUMMARY_TEMPLATES
 * @property {string[]} caveats          Built only from CAVEATS
 */

export const MIN_LOGGED_DAYS_PER_CYCLE = 5

/**
 * A tier is awarded when BOTH thresholds are met. Order matters: the highest
 * satisfied tier wins. 'none' is the result when 'emerging' is not met.
 */
export const TIER_THRESHOLDS = Object.freeze({
  emerging: Object.freeze({ minSupportingCycles: 2, minConsistency: 0.5 }),
  likely: Object.freeze({ minSupportingCycles: 3, minConsistency: 0.6 }),
  established: Object.freeze({ minSupportingCycles: 5, minConsistency: 0.75 }),
})

const TIER_ORDER = Object.freeze(['none', 'emerging', 'likely', 'established'])

/**
 * The only sentence shapes `summary` may use. They report counts and timing,
 * never mechanism. Placeholders: {label} {supporting} {assessable} {phase}.
 */
export const SUMMARY_TEMPLATES = Object.freeze({
  none: 'Not enough repeated logs of {label} yet to describe a pattern.',
  emerging: '{label} was logged during the {phase} phase in {supporting} of {assessable} tracked cycles.',
  likely: '{label} has shown up during the {phase} phase in {supporting} of {assessable} tracked cycles.',
  established: '{label} has consistently been logged during the {phase} phase — {supporting} of {assessable} tracked cycles.',
})

/** Every caveat the engine can emit. Plain language, no mechanism. */
export const CAVEATS = Object.freeze({
  /** @param {number} n */
  fewCycles: (n) => `Based on ${n} tracked cycle${n === 1 ? '' : 's'}. Patterns become clearer with more.`,
  /** @param {number} n */
  sparse: (n) => `${n} cycle${n === 1 ? ' was' : 's were'} not counted either way: too little was logged to tell.`,
  inProgress: 'Your current cycle is not assessed until it completes.',
  /** @param {string} label @param {number} n */
  scattered: (label, n) => `${label} was logged in ${n} cycles, but not concentrated in one phase.`,
  early: 'This is an early pattern. It may change as you log more.',
  /** @param {string} label */
  notCausal: (label) => `This describes when ${label} was logged, not why.`,
})

/**
 * Symptom vocabulary — mirrors SYMPTOMS in shared/constants.ts and the DB
 * CHECK (pinned by a test; the engine cannot import .ts at runtime yet).
 */
export const SYMPTOM_KEYS = Object.freeze([
  'cramps', 'headache', 'bloating', 'fatigue', 'breast_tenderness',
  'acne', 'back_pain', 'nausea', 'cravings', 'insomnia',
  'spotting', 'mood_swings', 'anxiety', 'irritability', 'low_libido',
  'high_libido', 'diarrhea', 'constipation', 'hot_flashes', 'dizziness',
])

/** Mood keys the engine assesses. Built from the 1–5 scale by `moodBucketFor`. */
export const MOOD_BUCKETS = Object.freeze(['low', 'neutral', 'high'])

/** Every (kind, key) the V2 model can assess. */
export const SUPPORTED_TARGETS = Object.freeze([
  ...MOOD_BUCKETS.map((key) => Object.freeze({ kind: 'mood', key })),
  ...SYMPTOM_KEYS.map((key) => Object.freeze({ kind: 'symptom', key })),
])

/** Labels used in summaries/caveats; mood labels follow API_CONTRACT.md §7.2. */
const MOOD_LABELS = Object.freeze({ low: 'Low mood', neutral: 'Neutral mood', high: 'Good mood' })

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const KINDS = new Set(['symptom', 'mood'])
const SYMPTOM_SET = new Set(SYMPTOM_KEYS)
const MOOD_SET = new Set(MOOD_BUCKETS)

export class PatternEngineError extends Error {
  /**
   * @param {'invalid_input'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message)
    this.name = 'PatternEngineError'
    this.code = code
  }
}

/**
 * Map a daily_observations.mood value (1–5) to the bucket the engine assesses.
 * 1–2 → 'low', 3 → 'neutral', 4–5 → 'high'. The orchestration layer calls this
 * when it turns rows into Observations.
 * @param {number} mood
 * @returns {MoodBucket}
 */
export function moodBucketFor(mood) {
  if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
    throw new PatternEngineError('invalid_input', 'mood must be an integer from 1 to 5')
  }
  if (mood <= 2) return 'low'
  if (mood === 3) return 'neutral'
  return 'high'
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isISODate = (value) => typeof value === 'string' && ISO_DATE_PATTERN.test(value)

/** @param {PatternInput} input */
function assertPatternInput(input) {
  if (!input || typeof input !== 'object') {
    throw new PatternEngineError('invalid_input', 'input must be an object')
  }
  if (!Array.isArray(input.observations)) {
    throw new PatternEngineError('invalid_input', 'observations must be an array')
  }
  for (const observation of input.observations) {
    if (
      !observation ||
      !isISODate(observation.date) ||
      !KINDS.has(observation.kind) ||
      typeof observation.key !== 'string' ||
      observation.key.length === 0
    ) {
      throw new PatternEngineError('invalid_input', 'each observation needs date, kind ("symptom"|"mood") and key')
    }
  }
  if (!Array.isArray(input.cycles)) {
    throw new PatternEngineError('invalid_input', 'cycles must be an array')
  }
  input.cycles.forEach((cycle, position) => {
    if (
      !cycle ||
      !Number.isInteger(cycle.index) ||
      !isISODate(cycle.startDate) ||
      !(cycle.endDate === null || isISODate(cycle.endDate)) ||
      !(Number.isInteger(cycle.typicalLength) && cycle.typicalLength > 0) ||
      !(Number.isInteger(cycle.loggedDays) && cycle.loggedDays >= 0)
    ) {
      throw new PatternEngineError('invalid_input', 'each cycle needs index, startDate, endDate|null, typicalLength, loggedDays')
    }
    if (cycle.endDate !== null && cycle.endDate < cycle.startDate) {
      throw new PatternEngineError('invalid_input', 'cycle endDate must not precede startDate')
    }
    if (cycle.endDate === null && position !== input.cycles.length - 1) {
      throw new PatternEngineError('invalid_input', 'only the last cycle may be in progress (endDate null)')
    }
    if (position > 0) {
      const previous = input.cycles[position - 1]
      if (cycle.startDate <= previous.startDate || (previous.endDate !== null && cycle.startDate <= previous.endDate)) {
        throw new PatternEngineError('invalid_input', 'cycles must be ascending and non-overlapping')
      }
    }
  })
}

/** @param {PatternTarget} target */
function assertTarget(target) {
  if (!target || !KINDS.has(target.kind) || typeof target.key !== 'string') {
    throw new PatternEngineError('invalid_input', 'target needs kind ("symptom"|"mood") and key')
  }
  if (target.kind === 'symptom' && !SYMPTOM_SET.has(target.key)) {
    throw new PatternEngineError('invalid_input', `unknown symptom key "${target.key}"`)
  }
  if (target.kind === 'mood' && !MOOD_SET.has(target.key)) {
    throw new PatternEngineError('invalid_input', `mood key must be one of ${MOOD_BUCKETS.join(', ')}`)
  }
}

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

const isSupportedTarget = (kind, key) => (kind === 'symptom' ? SYMPTOM_SET.has(key) : MOOD_SET.has(key))

/** 1-based cycle day of `date` inside `cycle`, using the cycle engine's calendar maths. */
const cycleDayOf = (cycle, date) => daysBetween(cycle.startDate, date) + 1

const inWindow = (cycle, date) => date >= cycle.startDate && (cycle.endDate === null || date <= cycle.endDate)

const isAssessable = (cycle) => cycle.endDate !== null && cycle.loggedDays >= MIN_LOGGED_DAYS_PER_CYCLE

/** @returns {EvidencePhase|null} */
function evidencePhase(cycle, cycleDay) {
  const phase = phaseForCycleDay(cycleDay, cycle.typicalLength, DEFAULT_PERIOD_LENGTH, 0)
  return phase === 'unknown' ? null : phase
}

/** Human label for a target, used only inside templates. */
function labelFor(target) {
  if (target.kind === 'mood') return MOOD_LABELS[target.key]
  const words = target.key.split('_').join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Phase in which the target appears in the most assessable cycles (one vote per
 * cycle per phase). Requires a strict plurality; a tie means no concentration.
 * @returns {EvidencePhase|null}
 */
function dominantPhaseOf(cycleRows) {
  const votes = new Map()
  for (const row of cycleRows) {
    if (!row.assessable) continue
    for (const phase of row.phases) votes.set(phase, (votes.get(phase) ?? 0) + 1)
  }
  let best = null
  let bestCount = 0
  let tied = false
  for (const [phase, count] of votes) {
    if (count > bestCount) {
      best = phase
      bestCount = count
      tied = false
    } else if (count === bestCount) {
      tied = true
    }
  }
  return tied || bestCount === 0 ? null : best
}

/** @returns {ConfidenceTier} */
function tierFor(supportingCycles, consistency) {
  for (const tier of ['established', 'likely', 'emerging']) {
    const { minSupportingCycles, minConsistency } = TIER_THRESHOLDS[tier]
    if (supportingCycles >= minSupportingCycles && consistency >= minConsistency) return tier
  }
  return 'none'
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assess how reliably one symptom or mood recurs in the same phase across cycles.
 *
 * Algorithm:
 *   1. For each cycle, collect the target's observations inside the window
 *      (deduplicated by date, ascending), their cycle days and phases.
 *   2. A cycle is assessable iff completed and loggedDays ≥ MIN_LOGGED_DAYS_PER_CYCLE;
 *      otherwise it is sparse and never counted either way.
 *   3. dominant phase = strict plurality of assessable cycles containing the target
 *      per phase (ties → null).
 *   4. supporting = assessable cycles with the target in the dominant phase.
 *      consistency = supporting / assessable (0 when assessable = 0).
 *   5. tier = highest TIER_THRESHOLDS entry satisfied by (supporting, consistency).
 *   6. dominantPhase is reported only when tier ≠ 'none'.
 *
 * Postconditions:
 *   - `evidence.length === cycles.length`, oldest → newest; sparse cycles carry
 *     `sparse: true`, `supports: false`, and are excluded from `assessableCycles`.
 *   - Fewer than 2 assessable cycles always yields tier 'none'.
 *   - `summary` is one of SUMMARY_TEMPLATES filled in; `caveats` come only from CAVEATS.
 *
 * @param {PatternInput} input
 * @param {PatternTarget} target
 * @returns {PatternAssessment}
 */
export function assessPattern(input, target) {
  assertPatternInput(input)
  assertTarget(target)

  const matching = input.observations.filter((o) => o.kind === target.kind && o.key === target.key)

  const rows = input.cycles.map((cycle) => {
    const observedOn = [...new Set(matching.filter((o) => inWindow(cycle, o.date)).map((o) => o.date))].sort()
    const cycleDays = observedOn.map((date) => cycleDayOf(cycle, date))
    const phasesPerObservation = cycleDays.map((day) => evidencePhase(cycle, day))
    const phases = new Set(phasesPerObservation.filter((p) => p !== null))
    const assessable = isAssessable(cycle)
    return {
      cycle,
      observedOn,
      cycleDays,
      phases,
      assessable,
      phase: phasesPerObservation.length > 0 && phases.size === 1 && !phasesPerObservation.includes(null) ? [...phases][0] : null,
    }
  })

  const dominant = dominantPhaseOf(rows)
  const assessableCycles = rows.filter((r) => r.assessable).length
  const sparseCycles = rows.length - assessableCycles
  const supportingRows = rows.filter((r) => r.assessable && dominant !== null && r.phases.has(dominant))
  const supportingCycles = supportingRows.length
  const rawConsistency = assessableCycles === 0 ? 0 : supportingCycles / assessableCycles
  const consistency = Math.round(rawConsistency * 1000) / 1000
  const tier = tierFor(supportingCycles, rawConsistency)
  const dominantPhase = tier === 'none' ? null : dominant
  const label = labelFor(target)

  const evidence = rows.map((r) => ({
    cycleIndex: r.cycle.index,
    cycleStart: r.cycle.startDate,
    observedOn: r.observedOn,
    cycleDays: r.cycleDays,
    phase: r.phase,
    supports: supportingRows.includes(r),
    sparse: !r.assessable,
  }))

  const summary = fill(SUMMARY_TEMPLATES[tier], {
    label,
    phase: dominantPhase ?? '',
    supporting: supportingCycles,
    assessable: assessableCycles,
  })

  const caveats = []
  if (assessableCycles < TIER_THRESHOLDS.established.minSupportingCycles) caveats.push(CAVEATS.fewCycles(assessableCycles))
  const lowLogging = rows.filter((r) => !r.assessable && r.cycle.endDate !== null).length
  if (lowLogging > 0) caveats.push(CAVEATS.sparse(lowLogging))
  if (rows.some((r) => r.cycle.endDate === null)) caveats.push(CAVEATS.inProgress)
  const cyclesWithTarget = rows.filter((r) => r.assessable && r.observedOn.length > 0).length
  if (dominant === null && cyclesWithTarget >= TIER_THRESHOLDS.emerging.minSupportingCycles) {
    caveats.push(CAVEATS.scattered(label, cyclesWithTarget))
  }
  if (tier === 'emerging') caveats.push(CAVEATS.early)
  if (tier !== 'none') caveats.push(CAVEATS.notCausal(label))

  return {
    target: { kind: target.kind, key: target.key },
    tier,
    totalCycles: rows.length,
    assessableCycles,
    supportingCycles,
    sparseCycles,
    consistency,
    dominantPhase,
    evidence,
    summary,
    caveats,
  }
}

/**
 * Assess every supported target that appears in `observations`.
 *
 * Candidates are SUPPORTED_TARGETS (three mood buckets + the symptom vocabulary)
 * restricted to (kind, key) pairs actually present, so absent targets — which
 * would trivially be 'none' — do not pad the result. Observations with keys
 * outside the vocabulary are ignored here (assessPattern rejects them as targets).
 *
 * Postconditions:
 *   - Sorted by tier (established → none), then `consistency` descending, then
 *     `target.key` ascending, then `target.kind` ascending — stable for identical input.
 *   - Targets with tier 'none' are included unless `options.minTier` excludes them.
 *
 * @param {PatternInput} input
 * @param {{ minTier?: ConfidenceTier }} [options]
 * @returns {PatternAssessment[]}
 */
export function assessAllPatterns(input, options = {}) {
  assertPatternInput(input)
  if (options.minTier !== undefined && !TIER_ORDER.includes(options.minTier)) {
    throw new PatternEngineError('invalid_input', 'minTier must be one of none, emerging, likely, established')
  }
  const minRank = TIER_ORDER.indexOf(options.minTier ?? 'none')

  const seen = new Set()
  const targets = []
  for (const observation of input.observations) {
    const id = `${observation.kind}:${observation.key}`
    if (seen.has(id) || !isSupportedTarget(observation.kind, observation.key)) continue
    seen.add(id)
    targets.push({ kind: observation.kind, key: observation.key })
  }

  return targets
    .map((target) => assessPattern(input, target))
    .filter((assessment) => TIER_ORDER.indexOf(assessment.tier) >= minRank)
    .sort(
      (a, b) =>
        TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) ||
        b.consistency - a.consistency ||
        (a.target.key < b.target.key ? -1 : a.target.key > b.target.key ? 1 : 0) ||
        (a.target.kind < b.target.kind ? -1 : a.target.kind > b.target.kind ? 1 : 0),
    )
}
