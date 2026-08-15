import { HeartHandshake } from 'lucide-react'
import Card from '../ui/Card'

function GentleReminderCard() {
  return (
    <Card className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <HeartHandshake className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-ink">A gentle reminder</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Whatever you&rsquo;re feeling right now is valid. You don&rsquo;t have to have it all figured
          out today &mdash; small steps count too.
        </p>
      </div>
    </Card>
  )
}

export default GentleReminderCard
