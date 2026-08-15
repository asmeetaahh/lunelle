import { Wind } from 'lucide-react'
import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import BreathingExerciseModal from './BreathingExerciseModal'

function WellnessCard() {
  const [isBreathingOpen, setIsBreathingOpen] = useState(false)

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Today&rsquo;s wellness</h2>

      <div className="mt-6 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-surface-alt p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Wind className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">2-minute breathing break</p>
            <p className="mt-1 text-sm text-ink-muted">
              Take a mindful pause to reset and recharge.
            </p>
          </div>
        </div>

        <Button className="shrink-0" onClick={() => setIsBreathingOpen(true)}>
          Start
        </Button>
      </div>

      {isBreathingOpen && <BreathingExerciseModal onClose={() => setIsBreathingOpen(false)} />}
    </Card>
  )
}

export default WellnessCard
