import Badge from '../ui/Badge'
import Card from '../ui/Card'

const MOODS = [
  { key: 'happy', label: 'Happy', emoji: '😊', count: 6 },
  { key: 'calm', label: 'Calm', emoji: '😌', count: 8 },
  { key: 'sad', label: 'Sad', emoji: '😔', count: 3 },
  { key: 'angry', label: 'Angry', emoji: '😠', count: 2 },
  { key: 'stressed', label: 'Stressed', emoji: '😵', count: 5 },
  { key: 'lonely', label: 'Lonely', emoji: '🥺', count: 2 },
]

const MAX_COUNT = Math.max(...MOODS.map((mood) => mood.count))

function MoodInsightsCard() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Mood insights</h2>
          <p className="mt-1 text-sm text-ink-muted">How you&rsquo;ve logged feeling over the last 14 days.</p>
        </div>
        <Badge>Sample data</Badge>
      </div>

      <div className="mt-6 space-y-3">
        {MOODS.map((mood) => {
          const widthPercent = (mood.count / MAX_COUNT) * 100
          return (
            <div key={mood.key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-ink-muted">
                <span aria-hidden="true">{mood.emoji}</span> {mood.label}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-alt">
                <div className="h-full rounded-full bg-primary" style={{ width: `${widthPercent}%` }} />
              </div>
              <span className="w-5 shrink-0 text-right text-sm font-semibold text-ink">{mood.count}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default MoodInsightsCard
