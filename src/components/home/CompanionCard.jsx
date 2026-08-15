import { MessageCircle, Wand2 } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'

function CompanionCard() {
  return (
    <Card className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Wand2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Want to talk?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Your AI companion is here to listen, any time of day.
          </p>
        </div>
      </div>

      <Button icon={MessageCircle} className="shrink-0">
        Talk to Lunelle
      </Button>
    </Card>
  )
}

export default CompanionCard
