import { Sparkles } from 'lucide-react'
import Card from '../ui/Card'

function PatternsCard() {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Your patterns</h2>
          <p className="mt-2 text-sm text-ink-muted">
            You&rsquo;ve logged feeling stressed several times over the past couple of weeks, alongside
            a few calmer, happier days too. Noticing these patterns can be a gentle first step &mdash;
            no explanations needed.
          </p>
        </div>
      </div>
    </Card>
  )
}

export default PatternsCard
