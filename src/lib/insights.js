import { JOURNAL_MOODS } from './journal'

const DEFAULT_WINDOW_DAYS = 14

// A single logged mood isn't a "pattern" yet — require at least a couple of
// entries before Patterns says anything, otherwise it shows the empty state.
const MIN_LOGGED_MOODS_FOR_PATTERN = 2

// Aggregates real journal entries into per-mood counts for the last
// `windowDays` days, using the same mood taxonomy Journal already defines
// (JOURNAL_MOODS) rather than a second, separate mood list.
export function summarizeMoods(entries, { windowDays = DEFAULT_WINDOW_DAYS, now = new Date() } = {}) {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - windowDays)

  const counts = new Map(JOURNAL_MOODS.map((mood) => [mood.key, 0]))

  for (const entry of entries) {
    if (entry.createdAt < cutoff) continue
    if (entry.mood && counts.has(entry.mood)) {
      counts.set(entry.mood, counts.get(entry.mood) + 1)
    }
  }

  const moods = JOURNAL_MOODS.map((mood) => ({ ...mood, count: counts.get(mood.key) ?? 0 }))
  const totalLoggedMoods = moods.reduce((sum, mood) => sum + mood.count, 0)

  return { windowDays, moods, totalLoggedMoods }
}

// A modest, non-correlated observation: which mood(s) came up most often in
// the window. Deliberately does not attempt to relate mood to cycle phase or
// any other field — that would be inventing a correlation the data doesn't
// actually support. Returns null when there isn't enough logged data yet.
export function describeMoodPattern(moodSummary) {
  if (!moodSummary || moodSummary.totalLoggedMoods < MIN_LOGGED_MOODS_FOR_PATTERN) {
    return null
  }

  const logged = moodSummary.moods.filter((mood) => mood.count > 0)
  const [top, second] = [...logged].sort((a, b) => b.count - a.count)

  const timesWord = top.count === 1 ? 'time' : 'times'
  let text = `You’ve logged feeling ${top.label.toLowerCase()} ${top.count} ${timesWord} over the last ${moodSummary.windowDays} days`

  if (second && second.count > 0) {
    text += `, alongside some ${second.label.toLowerCase()} days too`
  }

  text += '. Noticing these patterns can be a gentle first step — no explanations needed.'

  return text
}
