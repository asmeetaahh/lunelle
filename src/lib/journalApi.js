// Shared client for the existing Journal API. Insights reads through this
// exact same endpoint/shape that Journal.jsx already uses, rather than
// standing up a second source of truth for journal data.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function normalizeJournalEntry(entry) {
  return {
    id: entry.id,
    title: entry.title ?? '',
    body: entry.entry ?? '',
    mood: entry.mood ?? null,
    symptoms: entry.symptoms ?? [],
    cycleDay: entry.cycleDay ?? null,
    cycleLength: entry.cycleLength ?? null,
    phase: entry.phase ?? null,
    createdAt: new Date(entry.createdAt),
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : null,
  }
}

export async function fetchJournalEntries() {
  const response = await fetch(`${API_BASE_URL}/api/journal`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Could not load journal entries.')
  }

  return (data.journals ?? []).map(normalizeJournalEntry)
}

export async function deleteJournalEntry(id) {
  const response = await fetch(`${API_BASE_URL}/api/journal/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Could not delete journal entry.')
  }
}
