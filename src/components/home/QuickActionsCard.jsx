import { CalendarDays, Droplet, MessageCircle, Smile } from 'lucide-react'
import Card from '../ui/Card'

const ACTIONS = [
  { label: 'Log period', icon: Droplet },
  { label: 'Log mood', icon: Smile },
  { label: 'View calendar', icon: CalendarDays },
  { label: 'Talk to Lunelle', icon: MessageCircle },
]

function QuickActionsCard() {
  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Quick actions</h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-4 text-center transition-colors hover:bg-surface-alt"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink">{label}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}

export default QuickActionsCard
