import { useEffect, useMemo, useState } from 'react'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import CurrentCycleSummaryCard from '../components/insights/CurrentCycleSummaryCard'
import CycleProgressCard from '../components/insights/CycleProgressCard'
import MoodInsightsCard from '../components/insights/MoodInsightsCard'
import PatternsCard from '../components/insights/PatternsCard'
import PhaseInfoCard from '../components/insights/PhaseInfoCard'
import UpcomingCycleCard from '../components/insights/UpcomingCycleCard'
import { addDays, daysBetween, getCycleDayInfo, getCyclePhase } from '../lib/cycle'
import { getCycleFromSettings, getCycleSettings } from '../lib/cycleSettings'
import { describeMoodPattern, summarizeMoods } from '../lib/insights'
import { fetchJournalEntries } from '../lib/journalApi'

function Insights() {
  const today = useMemo(() => new Date(), [])
  const cycle = useMemo(() => getCycleFromSettings(getCycleSettings()), [])

  const { cycleDayNumber } = getCycleDayInfo(today, cycle)
  const phase = getCyclePhase(cycleDayNumber, cycle)
  const nextPeriodStart = addDays(cycle.lastPeriodStart, cycle.cycleLength)
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart)

  const [journalEntries, setJournalEntries] = useState([])
  const [isJournalLoading, setIsJournalLoading] = useState(true)
  const [journalError, setJournalError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadEntries = async () => {
      try {
        const entries = await fetchJournalEntries()
        if (isMounted) setJournalEntries(entries)
      } catch (error) {
        console.error('Insights journal loading error:', error)
        if (isMounted) setJournalError('Could not load your mood insights right now.')
      } finally {
        if (isMounted) setIsJournalLoading(false)
      }
    }

    loadEntries()

    return () => {
      isMounted = false
    }
  }, [])

  const moodSummary = useMemo(() => summarizeMoods(journalEntries), [journalEntries])
  const patternText = useMemo(() => describeMoodPattern(moodSummary), [moodSummary])

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
        <MoodInsightsCard
          isLoading={isJournalLoading}
          error={journalError}
          moods={moodSummary.moods}
          totalLoggedMoods={moodSummary.totalLoggedMoods}
          windowDays={moodSummary.windowDays}
        />
        <PatternsCard isLoading={isJournalLoading} error={journalError} patternText={patternText} />
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
