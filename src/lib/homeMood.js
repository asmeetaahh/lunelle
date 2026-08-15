import { toISODate } from './cycle'

// Persists the Home page's daily "How are you feeling today?" check-in.
// This is intentionally separate from Journal's per-entry mood (JOURNAL_MOODS
// in lib/journal.js) — it's a lightweight daily mood, not tied to a journal
// entry, so it gets its own storage key and never touches Journal's data.
const STORAGE_KEY = 'lunelle-home-mood'

export function getTodaysMood() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored)
    if (parsed.date !== toISODate(new Date())) return null

    return parsed.mood ?? null
  } catch (error) {
    console.error('Could not load today’s mood:', error)
    return null
  }
}

export function saveTodaysMood(mood) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: toISODate(new Date()), mood }),
  )
}
