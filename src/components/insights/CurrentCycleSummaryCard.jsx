import Badge from '../ui/Badge'
import Card from '../ui/Card'

function CurrentCycleSummaryCard({ cycleDayNumber, phase, cycleLength, daysUntilNextPeriod }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Current cycle summary</h2>
        <Badge>Live data</Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-sm text-ink-muted">Cycle day</p>
          <p className="mt-1 text-3xl font-extrabold text-ink sm:text-4xl">{cycleDayNumber}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Current phase</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">{phase}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Average cycle</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">{cycleLength} days</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Next period</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {daysUntilNextPeriod <= 0 ? 'Any day now' : `~${daysUntilNextPeriod} days`}
          </p>
        </div>
      </div>
    </Card>
  )
}

export default CurrentCycleSummaryCard
