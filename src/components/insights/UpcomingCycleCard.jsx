import { CalendarDays } from 'lucide-react'
import { addDays } from '../../lib/cycle'
import Card from '../ui/Card'

function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function UpcomingCycleCard({ cycleDayNumber, cycleLength, nextPeriodStart, periodLength }) {
  const nextPeriodEnd = addDays(nextPeriodStart, periodLength - 1)

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CalendarDays className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-ink">Looking ahead</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Estimated next period:{' '}
            <span className="font-semibold text-ink">
              {formatShortDate(nextPeriodStart)} &ndash; {formatShortDate(nextPeriodEnd)}
            </span>
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-ink-muted">Cycle day</dt>
              <dd className="mt-0.5 text-lg font-bold text-ink">{cycleDayNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Cycle length</dt>
              <dd className="mt-0.5 text-lg font-bold text-ink">{cycleLength} days</dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  )
}

export default UpcomingCycleCard
