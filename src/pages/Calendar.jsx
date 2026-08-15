import { useMemo, useState } from 'react'
import CalendarLegend from '../components/calendar/CalendarLegend'
import CycleSummaryCard from '../components/calendar/CycleSummaryCard'
import MonthGrid from '../components/calendar/MonthGrid'
import SelectedDayPanel from '../components/calendar/SelectedDayPanel'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import Card from '../components/ui/Card'
import { addDays, daysBetween, getCycleDayInfo, isSameDay, toISODate } from '../lib/cycle'
import { getCycleSettings } from '../lib/cycleSettings'

function Calendar() {
  const today = useMemo(() => new Date(), [])
  const cycleSettings = useMemo(() => getCycleSettings(), [])

  const cycle = useMemo(() => {
    const [year, month, day] = cycleSettings.lastPeriodDate.split('-').map(Number)

    return {
      lastPeriodStart: new Date(year, month - 1, day),
      cycleLength: cycleSettings.cycleLength,
      periodLength: cycleSettings.periodLength,
    }
  }, [cycleSettings])

  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(today)
  const [loggedDates, setLoggedDates] = useState(() => {
    const initial = new Set()
    for (let i = 0; i < cycle.periodLength; i += 1) {
      initial.add(toISODate(addDays(cycle.lastPeriodStart, i)))
    }
    return initial
  })

  const goToPrevMonth = () =>
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
  const goToNextMonth = () =>
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
  const goToToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const toggleLoggedDate = (date) => {
    const key = toISODate(date)
    setLoggedDates((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const nextPeriodStart = addDays(cycle.lastPeriodStart, cycle.cycleLength)
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart)
  const todayCycleInfo = getCycleDayInfo(today, cycle)
  const selectedCycleInfo = getCycleDayInfo(selectedDate, cycle)

  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Your calendar 🗓️</h1>
        <p className="mt-2 text-base text-ink-muted">
          Track your cycle and plan ahead with gentle predictions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <MonthGrid
            viewDate={viewDate}
            today={today}
            selectedDate={selectedDate}
            loggedDates={loggedDates}
            cycle={cycle}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            onToday={goToToday}
            onSelectDate={setSelectedDate}
          />
          <CalendarLegend />
        </Card>

        <div className="space-y-6">
          <CycleSummaryCard
            cycleDayNumber={todayCycleInfo.cycleDayNumber}
            cycleLength={cycle.cycleLength}
            daysUntilNextPeriod={daysUntilNextPeriod}
            onLogToday={() => toggleLoggedDate(today)}
          />
          <SelectedDayPanel
            date={selectedDate}
            isToday={isSameDay(selectedDate, today)}
            isLogged={loggedDates.has(toISODate(selectedDate))}
            cycleInfo={selectedCycleInfo}
            onToggleLog={() => toggleLoggedDate(selectedDate)}
          />
        </div>
      </div>
    </div>
  )
}

export default Calendar
