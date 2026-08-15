import { Sparkles } from 'lucide-react'
import Card from '../ui/Card'

function getBodyText({ isLoading, error, patternText }) {
  if (isLoading) return 'Looking through your recent journal entries…'
  if (error) return error
  if (patternText) return patternText

  return "Keep journaling to discover your patterns. Once you've logged a few moods, Lunelle will gently reflect them back to you here."
}

function PatternsCard({ isLoading, error, patternText }) {
  const bodyText = getBodyText({ isLoading, error, patternText })

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Your patterns</h2>
          <p className="mt-2 text-sm text-ink-muted">{bodyText}</p>
        </div>
      </div>
    </Card>
  )
}

export default PatternsCard
