import { useState } from 'react'
import Card from '../ui/Card'

const WEEK_START_OPTIONS = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
]

function AppPreferencesCard() {
  const [weekStart, setWeekStart] = useState('sunday')

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">App preferences</h2>
      <p className="mt-1 text-sm text-ink-muted">A few small details, just the way you like them.</p>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ink">Week starts on</p>
        <div className="mt-2 flex gap-2">
          {WEEK_START_OPTIONS.map((option) => {
            const isSelected = weekStart === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setWeekStart(option.key)}
                aria-pressed={isSelected}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  isSelected
                    ? 'bg-primary text-white'
                    : 'border border-border bg-surface text-ink-muted hover:bg-surface-alt',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

export default AppPreferencesCard
