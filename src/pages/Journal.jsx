import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import JournalEmptyState from '../components/journal/JournalEmptyState'
import JournalEntryCard from '../components/journal/JournalEntryCard'
import JournalEntryEditor from '../components/journal/JournalEntryEditor'
import Button from '../components/ui/Button'
import { createDraftFromEntry, createEntryId, createSampleEntries } from '../lib/journal'

function Journal() {
  const [entries, setEntries] = useState(() => createSampleEntries())
  const [draft, setDraft] = useState(null)
  const [isNewDraft, setIsNewDraft] = useState(false)

  const sortedEntries = [...entries].sort((a, b) => b.createdAt - a.createdAt)

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

  const saveDraft = () => {
    if (isNewDraft) {
      const newEntry = { ...draft, id: createEntryId(), createdAt: new Date() }
      setEntries((current) => [newEntry, ...current])
    } else {
      setEntries((current) =>
        current.map((entry) => (entry.id === draft.id ? { ...draft } : entry)),
      )
    }
    closeEditor()
  }

  const deleteDraft = () => {
    setEntries((current) => current.filter((entry) => entry.id !== draft.id))
    closeEditor()
  }

  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">Journal</h1>
          <p className="mt-2 text-base text-ink-muted">A quiet space for your thoughts.</p>
        </div>
        {!draft && (
          <Button icon={CirclePlus} onClick={openNewEntry}>
            New entry
          </Button>
        )}
      </div>

      {draft ? (
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
            <JournalEntryCard key={entry.id} entry={entry} onOpen={openEntry} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Journal
