import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WEEKDAY_LABELS, formatMonthYear, getMonthMatrix, isSameDay, toISODate } from '../../lib/cycle'
import DayCell from './DayCell'

function MonthGrid({
  viewDate,
  today,
  selectedDate,
  loggedDates,
  cycle,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}) {
  const weeks = getMonthMatrix(viewDate.getFullYear(), viewDate.getMonth())

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">{formatMonthYear(viewDate)}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-alt hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-alt hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-muted sm:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
        {weeks.flatMap((week) =>
          week.map((date) => (
            <DayCell
              key={toISODate(date)}
              date={date}
              inCurrentMonth={date.getMonth() === viewDate.getMonth()}
              isToday={isSameDay(date, today)}
              isSelected={isSameDay(date, selectedDate)}
              isLogged={loggedDates.has(toISODate(date))}
              cycle={cycle}
              onSelect={onSelectDate}
            />
          )),
        )}
      </div>
    </div>
  )
}

export default MonthGrid
