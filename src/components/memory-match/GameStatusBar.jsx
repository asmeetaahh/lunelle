import { RotateCcw } from 'lucide-react'
import Card from '../ui/Card'

function GameStatusBar({ moves, matchedPairs, totalPairs, onRestart }) {
  return (
    <Card className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-ink-muted">Pairs matched</p>
          <p className="mt-0.5 text-lg font-bold text-ink">
            {matchedPairs} / {totalPairs}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Moves</p>
          <p className="mt-0.5 text-lg font-bold text-ink">{moves}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Restart
      </button>
    </Card>
  )
}

export default GameStatusBar
