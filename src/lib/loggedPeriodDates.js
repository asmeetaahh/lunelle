// Local persistence for the period days a user has explicitly logged from
// the Calendar. Kept separate from cycleSettings.js (the predicted-cycle
// source of truth used to render dashed "predicted" days) since these are
// actual logged entries, not predictions.
const STORAGE_KEY = 'lunelle-logged-period-dates'

export function getLoggedPeriodDates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Could not load logged period dates:', error)
    return []
  }
}

export function saveLoggedPeriodDates(dates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates))
}
