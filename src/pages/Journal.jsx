import { CirclePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import JournalEmptyState from '../components/journal/JournalEmptyState'
import JournalEntryCard from '../components/journal/JournalEntryCard'
import JournalEntryEditor from '../components/journal/JournalEntryEditor'
import Button from '../components/ui/Button'
import { createDraftFromEntry } from '../lib/journal'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function normalizeEntry(entry) {
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

async function fetchEntries() {
  const response = await fetch(`${API_BASE_URL}/api/journal`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Could not load journal entries.')
  }

  return (data.journals ?? []).map(normalizeEntry)
}

function Journal() {
  const [entries, setEntries] = useState([])
  const [draft, setDraft] = useState(null)
  const [isNewDraft, setIsNewDraft] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setError('')
        const journals = await fetchEntries()
        setEntries(journals)
      } catch (loadError) {
        console.error('Journal loading error:', loadError)
        setError('Could not load your journal entries.')
      } finally {
        setIsLoading(false)
      }
    }

    loadEntries()
  }, [])

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )

  const openNewEntry = () => {
    setDraft(createDraftFromEntry(null))
    setIsNewDraft(true)
  }

  const openEntry = (id) => {
    const entry = entries.find((existing) => existing.id === id)

    if (!entry) return

    setDraft(createDraftFromEntry(entry))
    setIsNewDraft(false)
  }

  const closeEditor = () => {
    setDraft(null)
    setIsNewDraft(false)
  }

  const saveDraft = async () => {
    if (!draft) return

    try {
      setError('')

      const payload = {
        title: draft.title.trim(),
        entry: draft.body.trim(),
        mood: draft.mood,
        symptoms: draft.symptoms ?? [],
        cycleDay: draft.cycleDay ?? null,
        cycleLength: draft.cycleLength ?? null,
        phase: draft.phase ?? null,
      }

      const url = isNewDraft
        ? `${API_BASE_URL}/api/journal`
        : `${API_BASE_URL}/api/journal/${draft.id}`

      const response = await fetch(url, {
        method: isNewDraft ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not save journal entry.')
      }

      const savedEntry = normalizeEntry(data)
      localStorage.setItem('lunelle-last-journal-id', savedEntry.id)

      if (isNewDraft) {
        setEntries((current) => [savedEntry, ...current])
      } else {
        setEntries((current) =>
          current.map((entry) =>
            entry.id === savedEntry.id ? savedEntry : entry,
          ),
        )
      }

      closeEditor()
    } catch (saveError) {
      console.error('Journal save error:', saveError)
      setError('Could not save your journal entry. Please try again.')
    }
  }

  const deleteDraft = async () => {
    if (!draft || isNewDraft) {
      closeEditor()
      return
    }

    try {
      setError('')

      const response = await fetch(
        `${API_BASE_URL}/api/journal/${draft.id}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not delete journal entry.')
      }

      setEntries((current) =>
        current.filter((entry) => entry.id !== draft.id),
      )

      closeEditor()
    } catch (deleteError) {
      console.error('Journal delete error:', deleteError)
      setError('Could not delete this journal entry. Please try again.')
    }
  }

  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">Journal</h1>
          <p className="mt-2 text-base text-ink-muted">
            A quiet space for your thoughts.
          </p>
        </div>

        {!draft && (
          <Button icon={CirclePlus} onClick={openNewEntry}>
            New entry
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-primary/30 bg-primary-soft/40 px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-ink-muted">
          Loading your journal...
        </div>
      ) : draft ? (
        <JournalEntryEditor
          draft={draft}
          isNew={isNewDraft}
          onChange={setDraft}
          onSave={saveDraft}
          onCancel={closeEditor}
          onDelete={deleteDraft}
        />
      ) : entries.length === 0 ? (
        <JournalEmptyState onNewEntry={openNewEntry} />
      ) : (
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              onOpen={openEntry}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Journal