import { PartyPopper, RotateCcw } from 'lucide-react'
import BrandMark from '../ui/BrandMark'
import Button from '../ui/Button'
import Card from '../ui/Card'

function CompletionCelebration({ moves, onReplay }) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
      <BrandMark compact />
      <div className="flex items-center gap-2">
        <PartyPopper className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-ink">You found them all!</h2>
      </div>
      <p className="text-sm text-ink-muted">
        You matched every pair in {moves} {moves === 1 ? 'move' : 'moves'}. Well done!
      </p>
      <Button icon={RotateCcw} onClick={onReplay} className="mt-2">
        Play again
      </Button>
    </Card>
  )
}

export default CompletionCelebration
