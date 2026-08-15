import { CalendarDays, Droplet, MessageCircle, Smile } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'

function scrollToMoodSelector() {
  document.getElementById('mood-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function QuickActionsCard() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Log period', icon: Droplet, onClick: () => navigate('/calendar') },
    { label: 'Log mood', icon: Smile, onClick: scrollToMoodSelector },
    { label: 'View calendar', icon: CalendarDays, onClick: () => navigate('/calendar') },
    { label: 'Talk to Lunelle', icon: MessageCircle, onClick: () => navigate('/ai-companion') },
  ]

  return (
    <Card>
      <h2 className="text-xl font-bold text-ink">Quick actions</h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
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
