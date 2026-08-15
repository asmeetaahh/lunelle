import { useMemo } from 'react'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import CurrentCycleSummaryCard from '../components/insights/CurrentCycleSummaryCard'
import CycleProgressCard from '../components/insights/CycleProgressCard'
import MoodInsightsCard from '../components/insights/MoodInsightsCard'
import PatternsCard from '../components/insights/PatternsCard'
import PhaseInfoCard from '../components/insights/PhaseInfoCard'
import UpcomingCycleCard from '../components/insights/UpcomingCycleCard'
import { addDays, daysBetween, getCycleDayInfo, getCyclePhase } from '../lib/cycle'
import { getCycleFromSettings, getCycleSettings } from '../lib/cycleSettings'

function Insights() {
  const today = useMemo(() => new Date(), [])
  const cycle = useMemo(() => getCycleFromSettings(getCycleSettings()), [])

  const { cycleDayNumber } = getCycleDayInfo(today, cycle)
  const phase = getCyclePhase(cycleDayNumber, cycle)
  const nextPeriodStart = addDays(cycle.lastPeriodStart, cycle.cycleLength)
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart)

  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Cycle insights</h1>
        <p className="mt-2 text-base text-ink-muted">
          Lunelle helps you notice your own patterns over time &mdash; gently, and at your own pace.
        </p>
      </div>

      <CurrentCycleSummaryCard
        cycleDayNumber={cycleDayNumber}
        phase={phase}
        cycleLength={cycle.cycleLength}
        daysUntilNextPeriod={daysUntilNextPeriod}
      />

      <CycleProgressCard cycle={cycle} cycleDayNumber={cycleDayNumber} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MoodInsightsCard />
        <PatternsCard />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingCycleCard
          cycleDayNumber={cycleDayNumber}
          cycleLength={cycle.cycleLength}
          nextPeriodStart={nextPeriodStart}
          periodLength={cycle.periodLength}
        />
        <PhaseInfoCard phase={phase} />
      </div>
    </div>
  )
}

export default Insights
