import { useState } from 'react'
import Card from '../ui/Card'

const MOODS = [
  { key: 'happy', label: 'Happy', emoji: '😊' },
  { key: 'calm', label: 'Calm', emoji: '😌' },
  { key: 'sad', label: 'Sad', emoji: '😔' },
  { key: 'angry', label: 'Angry', emoji: '😠' },
  { key: 'stressed', label: 'Stressed', emoji: '😵' },
  { key: 'lonely', label: 'Lonely', emoji: '🥺' },
]

function MoodSelector() {
  const [selected, setSelected] = useState(null)

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">How are you feeling today?</h2>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {MOODS.map((mood) => {
          const isSelected = selected === mood.key
          return (
            <button
              key={mood.key}
              type="button"
              onClick={() => setSelected(mood.key)}
              aria-pressed={isSelected}
              className={[
                'flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition-colors',
                isSelected
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:bg-surface-alt',
              ].join(' ')}
            >
              <span className="text-2xl" aria-hidden="true">
                {mood.emoji}
              </span>
              <span className="text-sm font-medium text-ink">{mood.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export default MoodSelector
