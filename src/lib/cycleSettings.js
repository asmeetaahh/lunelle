import { addDays, toISODate } from './cycle'

const STORAGE_KEY = 'lunelle-cycle-settings'

export function getDefaultCycleSettings() {
  const today = new Date()

  return {
    lastPeriodDate: toISODate(addDays(today, -20)),
    cycleLength: 29,
    periodLength: 5,
  }
}

export function getCycleSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return getDefaultCycleSettings()
    }

    const parsed = JSON.parse(stored)

    return {
      ...getDefaultCycleSettings(),
      ...parsed,
    }
  } catch (error) {
    console.error('Could not load cycle settings:', error)
    return getDefaultCycleSettings()
  }
}

export function saveCycleSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
export function getCycleFromSettings(settings) {
  const [year, month, day] = settings.lastPeriodDate.split('-').map(Number)

  return {
    lastPeriodStart: new Date(year, month - 1, day),
    cycleLength: settings.cycleLength,
    periodLength: settings.periodLength,
  }
}