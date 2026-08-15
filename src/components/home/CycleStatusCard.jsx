import { CirclePlus, Heart } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'

const CYCLE_DAY = 21
const CYCLE_LENGTH = 29
const PROGRESS = Math.round((CYCLE_DAY / CYCLE_LENGTH) * 100)

function CycleStatusCard() {
  return (
    <Card className="relative overflow-visible">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Cycle status</h2>
        <Badge>Sample data</Badge>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div>
          <p className="text-sm text-ink-muted">Cycle day</p>
          <p className="mt-1 text-4xl font-extrabold text-ink sm:text-5xl">{CYCLE_DAY}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Current phase</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">Luteal phase</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Expected next period</p>
          <p className="mt-1 text-xl font-bold text-ink sm:text-2xl">In about 7 days</p>
        </div>
      </div>

      <div className="relative mt-8">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Day {CYCLE_DAY} of {CYCLE_LENGTH}
          </span>
          <span>{PROGRESS}%</span>
        </div>
        <div className="relative mt-2">
          <Heart
            className="absolute -top-3.5 h-4 w-4 -translate-x-1/2 fill-primary text-primary"
            style={{ left: `${PROGRESS}%` }}
            aria-hidden="true"
          />
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft/60">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${PROGRESS}%` }}
            />
          </div>
        </div>
      </div>

      <Button icon={CirclePlus} className="mt-8">
        Log today
      </Button>
    </Card>
  )
}

export default CycleStatusCard
