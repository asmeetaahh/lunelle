import { useMemo } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import { daysBetween, getCycleDayInfo } from '../../lib/cycle'
import { getCycleFromSettings, getCycleSettings } from '../../lib/cycleSettings'

function CycleInsightsCard() {
  const cycle = useMemo(
    () => getCycleFromSettings(getCycleSettings()),
    [],
  )

  const today = new Date()
  const cycleInfo = getCycleDayInfo(today, cycle)
  const cycleDay = cycleInfo.cycleDayNumber

  const nextPeriodStart = new Date(cycle.lastPeriodStart)
  nextPeriodStart.setDate(nextPeriodStart.getDate() + cycle.cycleLength)

  const daysUntilNextPeriod = Math.max(
    0,
    daysBetween(today, nextPeriodStart),
  )

  const insights = [
    { label: 'Cycle day', value: String(cycleDay) },
    { label: 'Average cycle', value: `${cycle.cycleLength} days` },
    {
      label: 'Next period',
      value: daysUntilNextPeriod === 0
        ? 'Today'
        : `~${daysUntilNextPeriod} days`,
    },
  ]

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Cycle insights</h2>
        <Badge>Live data</Badge>
      </div>

      <dl className="mt-6 divide-y divide-border">
        {insights.map((insight) => (
          <div
            key={insight.label}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
          >
            <dt className="text-base text-ink-muted">{insight.label}</dt>
            <dd className="text-lg font-bold text-ink">{insight.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export default CycleInsightsCard