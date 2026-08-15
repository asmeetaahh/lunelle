import { formatFullDate } from '../../lib/cycle'
import { getMoodByKey } from '../../lib/journal'

function getPreview(body, maxLength = 140) {
  const trimmed = (body ?? '').trim()
  if (!trimmed) return 'No content yet.'
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trimEnd()}…` : trimmed
}

function JournalEntryCard({ entry, onOpen }) {
  const mood = getMoodByKey(entry.mood)

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.id)}
      className="w-full rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:bg-surface-alt"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">{formatFullDate(entry.createdAt)}</p>
          <h3 className="mt-1 text-base font-bold text-ink">
            {entry.title?.trim() || 'Untitled entry'}
          </h3>
        </div>
        {mood && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            <span aria-hidden="true">{mood.emoji}</span> {mood.label}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{getPreview(entry.body)}</p>
    </button>
  )
}

export default JournalEntryCard
