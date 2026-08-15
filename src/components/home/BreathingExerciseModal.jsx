import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'

const TOTAL_SECONDS = 120

const PHASES = [
  { key: 'in', label: 'Breathe in…', seconds: 4 },
  { key: 'hold', label: 'Hold…', seconds: 4 },
  { key: 'out', label: 'Breathe out…', seconds: 4 },
]

const CYCLE_SECONDS = PHASES.reduce((total, phase) => total + phase.seconds, 0)

function getPhaseAt(elapsedSeconds) {
  const position = elapsedSeconds % CYCLE_SECONDS
  let boundary = 0

  for (const phase of PHASES) {
    boundary += phase.seconds
    if (position < boundary) return phase
  }

  return PHASES[0]
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function BreathingExerciseModal({ onClose }) {
  const [elapsed, setElapsed] = useState(0)
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    if (isDone) return undefined

    const interval = setInterval(() => {
      setElapsed((current) => {
        const next = current + 1
        if (next >= TOTAL_SECONDS) {
          setIsDone(true)
          return TOTAL_SECONDS
        }
        return next
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isDone])

  const remaining = TOTAL_SECONDS - elapsed
  const phase = getPhaseAt(elapsed)
  const isExpanded = phase.key !== 'out'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm rounded-[28px] border border-border bg-surface p-6 text-center shadow-xl sm:p-8">
        <div className="flex justify-end">
          <IconButton label="Close breathing exercise" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>

        {isDone ? (
          <>
            <p className="text-3xl" aria-hidden="true">
              🌸
            </p>
            <h2 className="mt-3 text-xl font-bold text-ink">Nicely done</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Hope that gave you a soft moment to reset.
            </p>
            <Button onClick={onClose} className="mt-6 w-full justify-center">
              Close
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-40 w-40 items-center justify-center">
              <div
                className="flex h-28 w-28 items-center justify-center rounded-full bg-primary-soft text-primary ease-in-out"
                style={{
                  transform: isExpanded ? 'scale(1.15)' : 'scale(0.75)',
                  transitionProperty: 'transform',
                  transitionDuration: '4000ms',
                }}
              >
                <span className="text-3xl" aria-hidden="true">
                  💗
                </span>
              </div>
            </div>

            <p className="mt-6 text-lg font-semibold text-ink">{phase.label}</p>
            <p className="mt-1 text-sm text-ink-muted">{formatCountdown(remaining)} remaining</p>

            <button
              type="button"
              onClick={onClose}
              className="mt-6 text-sm font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Finish early
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default BreathingExerciseModal
