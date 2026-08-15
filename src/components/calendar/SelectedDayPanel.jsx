import { CircleMinus, CirclePlus } from 'lucide-react'
import { formatFullDate } from '../../lib/cycle'
import Button from '../ui/Button'
import Card from '../ui/Card'

function getStatusLabel({ isLogged, isPredicted, isOvulationDay, isFertileWindow }) {
  if (isLogged) return 'Period logged'
  if (isPredicted) return 'Predicted period day'
  if (isOvulationDay) return 'Estimated ovulation day'
  if (isFertileWindow) return 'Fertile window'
  return 'No entries yet'
}

function SelectedDayPanel({ date, isToday, isLogged, cycleInfo, onToggleLog }) {
  const { isPeriodWindow, isFertileWindow, isOvulationDay, cycleDayNumber } = cycleInfo
  const isPredicted = isPeriodWindow && !isLogged
  const statusLabel = getStatusLabel({ isLogged, isPredicted, isOvulationDay, isFertileWindow })

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-ink">{formatFullDate(date)}</h2>
        {isToday && (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
            Today
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Cycle day {cycleDayNumber} &middot; {statusLabel}
      </p>

      <Button
        icon={isLogged ? CircleMinus : CirclePlus}
        onClick={onToggleLog}
        className="mt-6 w-full justify-center"
      >
        {isLogged ? 'Remove period log' : 'Log period for this day'}
      </Button>
    </Card>
  )
}

export default SelectedDayPanel
