import Badge from '../ui/Badge'
import Card from '../ui/Card'

const INSIGHTS = [
  { label: 'Cycle day', value: '21' },
  { label: 'Average cycle', value: '29 days' },
  { label: 'Next period', value: '~7 days' },
]

function CycleInsightsCard() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Cycle insights</h2>
        <Badge>Sample data</Badge>
      </div>

      <dl className="mt-6 divide-y divide-border">
        {INSIGHTS.map((insight) => (
          <div key={insight.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <dt className="text-base text-ink-muted">{insight.label}</dt>
            <dd className="text-lg font-bold text-ink">{insight.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export default CycleInsightsCard
