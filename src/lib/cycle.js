export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function addDays(date, amount) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function daysBetween(from, to) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY)
}

export function toISODate(date) {
  const d = startOfDay(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatFullDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// Returns a fixed 6x7 grid of dates (including leading/trailing days from
// adjacent months) so every month renders at the same height.
export function getMonthMatrix(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay())

  const weeks = []
  let cursor = gridStart
  for (let week = 0; week < 6; week += 1) {
    const days = []
    for (let day = 0; day < 7; day += 1) {
      days.push(cursor)
      cursor = addDays(cursor, 1)
    }
    weeks.push(days)
  }
  return weeks
}

// Derives a date's position within the sample cycle: which cycle-day number
// it falls on, whether it sits in a period window, and whether it sits in
// the estimated fertile window / ovulation day for that cycle.
export function getCycleDayInfo(date, { lastPeriodStart, cycleLength, periodLength }) {
  const diff = daysBetween(lastPeriodStart, date)
  const cycleIndex = Math.floor(diff / cycleLength)
  const dayInCycle = diff - cycleIndex * cycleLength

  const isPeriodWindow = dayInCycle < periodLength

  const ovulationDayInCycle = cycleLength - 14
  const fertileStart = ovulationDayInCycle - 5
  const fertileEnd = ovulationDayInCycle + 1
  const isOvulationDay = dayInCycle === ovulationDayInCycle && !isPeriodWindow
  const isFertileWindow =
    dayInCycle >= fertileStart && dayInCycle <= fertileEnd && !isPeriodWindow

  return {
    cycleDayNumber: dayInCycle + 1,
    isPeriodWindow,
    isFertileWindow,
    isOvulationDay,
  }
}

// Names the four broad phases of a cycle and their day-range boundaries
// (1-based, inclusive) so both the day-by-day calendar and the higher-level
// insights views can describe "where" a given cycle day falls consistently.
export function getCyclePhaseRanges({ cycleLength, periodLength }) {
  const ovulationDay = cycleLength - 14 + 1

  return [
    { phase: 'Period', startDay: 1, endDay: periodLength },
    { phase: 'Follicular', startDay: periodLength + 1, endDay: ovulationDay - 1 },
    { phase: 'Ovulation', startDay: ovulationDay, endDay: ovulationDay },
    { phase: 'Luteal', startDay: ovulationDay + 1, endDay: cycleLength },
  ]
}

export function getCyclePhase(cycleDayNumber, cycle) {
  const ranges = getCyclePhaseRanges(cycle)
  const match = ranges.find(
    (range) => cycleDayNumber >= range.startDay && cycleDayNumber <= range.endDay,
  )
  return match ? match.phase : ranges[ranges.length - 1].phase
}
