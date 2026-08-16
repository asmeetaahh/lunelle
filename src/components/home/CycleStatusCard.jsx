import { CirclePlus, Heart } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { daysBetween, getCycleDayInfo, getCyclePhase } from '../../lib/cycle'
import { getCycleFromSettings, getCycleSettings } from '../../lib/cycleSettings'

function CycleStatusCard() {
  const navigate = useNavigate()
  const cycle = useMemo(
    () => getCycleFromSettings(getCycleSettings()),
    [],
  )

  const today = new Date()
  const cycleInfo = getCycleDayInfo(today, cycle)
  const cycleDay = cycleInfo.cycleDayNumber
  const cycleLength = cycle.cycleLength
  const progress = Math.min(100, Math.round((cycleDay / cycleLength) * 100))
  const phase = getCyclePhase(cycleDay, cycle)

  const nextPeriodStart = new Date(cycle.lastPeriodStart)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + cycleLength)

  const daysUntilNextPeriod = Math.max(
    0,
    daysBetween(today, nextPeriodStart),
  )

  return (
    <Card className="relative overflow-visible">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Cycle status</h2>
        <Badge>Live data</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div>
          <p className="text-sm text-ink-muted">Cycle day</p>
          <p className="mt-1 text-4xl font-extrabold text-ink sm:text-5xl">
            {cycleDay}
          </p>
        </div>

        <div>
          <p className="text-sm text-ink-muted">Current phase</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {phase} phase
          </p>
        </div>

        <div>
          <p className="text-sm text-ink-muted">Expected next period</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">
            {daysUntilNextPeriod === 0
              ? 'Today'
              : `In about ${daysUntilNextPeriod} days`}
          </p>
        </div>
      </div>

      <div className="relative mt-8">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Day {cycleDay} of {cycleLength}
          </span>
          <span>{progress}%</span>
        </div>

        <div className="relative mt-2">
          <Heart
            className="absolute -top-3.5 h-4 w-4 -translate-x-1/2 fill-primary text-primary"
            style={{ left: `${progress}%` }}
            aria-hidden="true"
          />

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft/60">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <Button icon={CirclePlus} className="mt-8" onClick={() => navigate('/calendar')}>
        Log today
      </Button>
    </Card>
  )
}

export default CycleStatusCard