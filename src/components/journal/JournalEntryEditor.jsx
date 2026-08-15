import { useState } from 'react'
import { CircleCheck, Trash2 } from 'lucide-react'
import { formatFullDate } from '../../lib/cycle'
import { JOURNAL_MOODS } from '../../lib/journal'
import Button from '../ui/Button'
import Card from '../ui/Card'

function JournalEntryEditor({ draft, isNew, onChange, onSave, onCancel, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const canSave = draft.title.trim().length > 0 || draft.body.trim().length > 0

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted">{formatFullDate(draft.createdAt)}</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{isNew ? 'New entry' : 'Edit entry'}</h2>
        </div>
        {!isNew && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-primary"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>

      {confirmingDelete ? (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4">
          <p className="text-sm font-medium text-ink">Delete this entry? This can&rsquo;t be undone.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={onDelete}>Delete entry</Button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-alt"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            placeholder="Give it a title (optional)"
            className="mt-6 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base font-semibold text-ink placeholder:font-normal placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {JOURNAL_MOODS.map((mood) => {
              const isSelected = draft.mood === mood.key
              return (
                <button
                  key={mood.key}
                  type="button"
                  onClick={() => onChange({ ...draft, mood: isSelected ? null : mood.key })}
                  aria-pressed={isSelected}
                  className={[
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    isSelected
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border text-ink-muted hover:bg-surface-alt',
                  ].join(' ')}
                >
                  <span aria-hidden="true">{mood.emoji}</span> {mood.label}
                </button>
              )
            })}
          </div>

          <textarea
            value={draft.body}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            placeholder="What's on your mind today?"
            rows={8}
            className="mt-4 w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-primary focus:outline-none"
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              icon={CircleCheck}
              onClick={onSave}
              disabled={!canSave}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save entry
            </Button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Card>
  )
}

export default JournalEntryEditor
