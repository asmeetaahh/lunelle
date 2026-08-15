import { getCycleDayInfo } from '../../lib/cycle'

function DayCell({ date, inCurrentMonth, isToday, isSelected, isLogged, cycle, onSelect }) {
  const { isPeriodWindow, isFertileWindow, isOvulationDay } = getCycleDayInfo(date, cycle)
  const isPredicted = isPeriodWindow && !isLogged

  const fillClasses = isLogged
    ? 'bg-primary text-white font-semibold'
    : isPredicted
      ? 'border-2 border-dashed border-primary/50 bg-primary-soft/50 font-medium text-primary'
      : isFertileWindow
        ? 'bg-accent-soft/70'
        : 'hover:bg-surface-alt'

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-current={isToday ? 'date' : undefined}
      aria-pressed={isSelected}
      className={[
        'relative flex aspect-square items-center justify-center rounded-full text-sm transition-colors',
        inCurrentMonth ? 'text-ink' : 'text-ink-muted/40',
        fillClasses,
        isToday ? 'ring-2 ring-accent' : '',
        isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : '',
      ].join(' ')}
    >
      <span>{date.getDate()}</span>
      {isOvulationDay && (
        <span
          className="absolute -bottom-0.5 h-1.5 w-1.5 rounded-full bg-accent"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default DayCell
