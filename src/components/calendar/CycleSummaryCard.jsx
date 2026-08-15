import { CirclePlus } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'

function CycleSummaryCard({ cycleDayNumber, cycleLength, daysUntilNextPeriod, onLogToday }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Cycle summary</h2>
        <Badge>Sample data</Badge>
      </div>

      <dl className="mt-6 divide-y divide-border">
        <div className="flex items-center justify-between py-3 first:pt-0">
          <dt className="text-base text-ink-muted">Cycle day</dt>
          <dd className="text-lg font-bold text-ink">{cycleDayNumber}</dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-base text-ink-muted">Average cycle</dt>
          <dd className="text-lg font-bold text-ink">{cycleLength} days</dd>
        </div>
        <div className="flex items-center justify-between py-3 last:pb-0">
          <dt className="text-base text-ink-muted">Next expected period</dt>
          <dd className="text-lg font-bold text-ink">
            {daysUntilNextPeriod <= 0 ? 'Any day now' : `In ${daysUntilNextPeriod} days`}
          </dd>
        </div>
      </dl>

      <Button icon={CirclePlus} onClick={onLogToday} className="mt-6 w-full justify-center">
        Log today
      </Button>
    </Card>
  )
}

export default CycleSummaryCard
