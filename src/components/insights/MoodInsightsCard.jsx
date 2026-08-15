import Badge from '../ui/Badge'
import Card from '../ui/Card'

function MoodInsightsCard({ isLoading, error, moods = [], totalLoggedMoods = 0, windowDays = 14 }) {
  const maxCount = Math.max(1, ...moods.map((mood) => mood.count))

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Mood insights</h2>
          <p className="mt-1 text-sm text-ink-muted">
            How you&rsquo;ve logged feeling over the last {windowDays} days.
          </p>
        </div>
        <Badge>Live data</Badge>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-ink-muted">Loading your mood insights&hellip;</p>
      ) : error ? (
        <p className="mt-6 text-sm text-ink-muted">{error}</p>
      ) : totalLoggedMoods === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">
          No moods logged yet in the last {windowDays} days. Add a mood to a journal entry to see
          your patterns here.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {moods.map((mood) => {
            const widthPercent = (mood.count / maxCount) * 100
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
      )}
    </Card>
  )
}

export default MoodInsightsCard
