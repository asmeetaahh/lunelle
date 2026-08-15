import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { formatFullDate } from '../../lib/cycle'
import { getCycleSettings, saveCycleSettings } from '../../lib/cycleSettings'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'

function parseLocalDate(isoDateString) {
  const [year, month, day] = isoDateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function CycleSettingsCard() {
  const [settings, setSettings] = useState(() => getCycleSettings())
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(() => getCycleSettings())

  const startEditing = () => {
    setDraft(settings)
    setIsEditing(true)
  }

  const cancelEditing = () => setIsEditing(false)

  const saveEditing = () => {
    saveCycleSettings(draft)
    setSettings(draft)
    setIsEditing(false)
}

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Cycle settings</h2>
          <p className="mt-1 text-sm text-ink-muted">Helps Lunelle personalize your predictions.</p>
        </div>
        {!isEditing && <Badge>Sample data</Badge>}
      </div>

      {isEditing ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-ink-muted">Last period date</span>
            <input
              type="date"
              value={draft.lastPeriodDate}
              onChange={(event) => setDraft({ ...draft, lastPeriodDate: event.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Average cycle length (days)</span>
            <input
              type="number"
              min={15}
              max={60}
              value={draft.cycleLength}
              onChange={(event) => setDraft({ ...draft, cycleLength: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Period duration (days)</span>
            <input
              type="number"
              min={1}
              max={14}
              value={draft.periodLength}
              onChange={(event) => setDraft({ ...draft, periodLength: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
        </div>
      ) : (
        <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-muted">Last period date</dt>
            <dd className="mt-1 text-lg font-bold text-ink">
              {formatFullDate(parseLocalDate(settings.lastPeriodDate))}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Average cycle length</dt>
            <dd className="mt-1 text-lg font-bold text-ink">{settings.cycleLength} days</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Period duration</dt>
            <dd className="mt-1 text-lg font-bold text-ink">{settings.periodLength} days</dd>
          </div>
        </dl>
      )}

      <div className="mt-6">
        {isEditing ? (
          <div className="flex gap-3">
            <Button onClick={saveEditing}>Save changes</Button>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-2xl border border-border px-6 py-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-alt"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>
    </Card>
  )
}

export default CycleSettingsCard
