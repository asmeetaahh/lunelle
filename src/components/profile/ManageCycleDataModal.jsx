import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatFullDate } from '../../lib/cycle'
import { getMoodByKey } from '../../lib/journal'
import { deleteJournalEntry, fetchJournalEntries } from '../../lib/journalApi'
import ProfileModal from './ProfileModal'

function ManageCycleDataModal({ onClose }) {
  const [entries, setEntries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let isMounted = true

    fetchJournalEntries()
      .then((data) => {
        if (isMounted) setEntries(data)
      })
      .catch((loadError) => {
        console.error('Manage cycle data load error:', loadError)
        if (isMounted) setError('Could not load your stored entries right now.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleDelete = async (id) => {
    setDeletingId(id)
    setError('')

    try {
      await deleteJournalEntry(id)
      setEntries((current) => current.filter((entry) => entry.id !== id))
    } catch (deleteError) {
      console.error('Manage cycle data delete error:', deleteError)
      setError('Could not delete that entry. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ProfileModal title="Manage cycle data" onClose={onClose}>
      <p className="text-sm text-ink-muted">
        Every journal entry you&rsquo;ve saved, in one place. You can remove individual entries here.
      </p>

      {error && <p className="mt-3 text-sm text-ink-muted">{error}</p>}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-ink-muted">Loading your entries&hellip;</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink-muted">You don&rsquo;t have any saved journal entries yet.</p>
        ) : (
          entries.map((entry) => {
            const mood = getMoodByKey(entry.mood)
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-alt px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {entry.title || 'Untitled entry'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatFullDate(entry.createdAt)}
                    {mood ? ` · ${mood.emoji} ${mood.label}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  aria-label={`Delete entry: ${entry.title || 'Untitled entry'}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-primary disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </ProfileModal>
  )
}

export default ManageCycleDataModal
