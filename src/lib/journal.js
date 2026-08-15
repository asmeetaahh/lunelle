import { addDays, getCycleDayInfo, getCyclePhase } from './cycle'
import { getCycleFromSettings, getCycleSettings } from './cycleSettings'

// This module is the data layer for journaling. Every entry currently lives
// in local React state (see src/pages/Journal.jsx); the shapes and helpers
// here are written so that layer can later be swapped for a persisted store
// (e.g. Supabase) without changing the components that consume it.

export const JOURNAL_MOODS = [
  { key: 'happy', label: 'Happy', emoji: '😊' },
  { key: 'calm', label: 'Calm', emoji: '😌' },
  { key: 'sad', label: 'Sad', emoji: '😔' },
  { key: 'angry', label: 'Angry', emoji: '😠' },
  { key: 'stressed', label: 'Stressed', emoji: '😵' },
  { key: 'lonely', label: 'Lonely', emoji: '🥺' },
]

export function getMoodByKey(key) {
  return JOURNAL_MOODS.find((mood) => mood.key === key) ?? null
}

let idSequence = 0
export function createEntryId() {
  idSequence += 1
  return `entry-${Date.now()}-${idSequence}`
}

// A draft is a plain, editable copy of an entry (or a blank one for a new
// entry) kept separate from the committed entries list so Cancel can discard
// changes without mutating stored data. Editing an existing entry preserves
// whatever cycle context it already has (via the `{ ...entry }` spread); a
// brand-new entry is stamped with the user's *current* cycle position, using
// the same shared cycle helpers Home/Calendar/Profile already read from.
export function createDraftFromEntry(entry) {
  if (entry) {
    return { ...entry }
  }

  const cycle = getCycleFromSettings(getCycleSettings())
  const { cycleDayNumber } = getCycleDayInfo(new Date(), cycle)
  const phase = getCyclePhase(cycleDayNumber, cycle)

  return {
    id: null,
    title: '',
    body: '',
    mood: null,
    cycleDay: cycleDayNumber,
    cycleLength: cycle.cycleLength,
    phase,
    createdAt: new Date(),
  }
}

export function createSampleEntries() {
  const today = new Date()

  return [
    {
      id: createEntryId(),
      title: 'A softer day',
      mood: 'calm',
      createdAt: addDays(today, -1),
      body: "Today felt a little lighter than yesterday. I made tea, sat by the window, and let myself do nothing for a while. It's okay to have quiet days.",
    },
    {
      id: createEntryId(),
      title: 'Overwhelmed, but okay',
      mood: 'stressed',
      createdAt: addDays(today, -3),
      body: 'Work piled up and I felt behind on everything. I took a short walk in the evening and it helped a little. Trying to remember I can only do one thing at a time.',
    },
    {
      id: createEntryId(),
      title: 'Grateful for small things',
      mood: 'happy',
      createdAt: addDays(today, -6),
      body: "Had coffee with a friend I hadn't seen in a while. It reminded me how good it feels to laugh about nothing in particular. Want to do that more often.",
    },
  ]
}
