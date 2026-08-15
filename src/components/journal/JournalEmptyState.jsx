import { BookOpen, CirclePlus } from 'lucide-react'
import Button from '../ui/Button'

function JournalEmptyState({ onNewEntry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <BookOpen className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-ink">Your journal is waiting</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        This is your quiet space. Write down whatever&rsquo;s on your mind &mdash; there&rsquo;s no wrong
        way to do it.
      </p>
      <Button icon={CirclePlus} onClick={onNewEntry} className="mt-6">
        Write your first entry
      </Button>
    </div>
  )
}

export default JournalEmptyState
