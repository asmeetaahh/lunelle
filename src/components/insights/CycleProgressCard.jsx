import { getCyclePhaseRanges } from '../../lib/cycle'
import Card from '../ui/Card'

const PHASE_SWATCH = {
  Period: 'bg-primary',
  Follicular: 'bg-primary/55',
  Ovulation: 'bg-accent',
  Luteal: 'bg-primary/25',
}

function CycleProgressCard({ cycle, cycleDayNumber }) {
  const ranges = getCyclePhaseRanges(cycle)
  const markerPercent = ((cycleDayNumber - 0.5) / cycle.cycleLength) * 100

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Cycle progress</h2>
      <p className="mt-1 text-sm text-ink-muted">A gentle look at where you are in your cycle.</p>

      <div className="relative mt-10">
        <div
          className="absolute -top-7 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${markerPercent}%` }}
        >
          <span className="whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-surface">
            Today
          </span>
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-surface ring-2 ring-accent" aria-hidden="true" />
        </div>

        <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
          {ranges.map((range) => {
            const span = range.endDay - range.startDay + 1
            const widthPercent = (span / cycle.cycleLength) * 100
            return (
              <div
                key={range.phase}
                className={`h-full ${PHASE_SWATCH[range.phase]}`}
                style={{ width: `${widthPercent}%` }}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ranges.map((range) => (
          <div key={range.phase} className="flex items-center gap-2 text-xs text-ink-muted">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${PHASE_SWATCH[range.phase]}`}
              aria-hidden="true"
            />
            {range.phase}
          </div>
        ))}
      </div>
    </Card>
  )
}

export default CycleProgressCard
