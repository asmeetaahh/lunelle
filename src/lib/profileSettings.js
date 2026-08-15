// Local persistence for Profile preferences that don't belong in
// cycleSettings.js (which is specifically the cycle day/length/period
// source of truth shared with Home, Calendar, and Insights). Mirrors that
// module's get/save shape so components can read fresh state right before
// writing their own slice back, without clobbering fields other Profile
// cards may have changed in the same session.
const STORAGE_KEY = 'lunelle-profile-settings'

export function getDefaultProfileSettings() {
  return {
    displayName: 'Asmita',
    subtitle: 'Tracking my cycle, one gentle day at a time. 🌸',
    notifications: true,
    gentleReminders: true,
    weekStart: 'sunday',
  }
}

export function getProfileSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return getDefaultProfileSettings()

    const parsed = JSON.parse(stored)
    return { ...getDefaultProfileSettings(), ...parsed }
  } catch (error) {
    console.error('Could not load profile settings:', error)
    return getDefaultProfileSettings()
  }
}

export function saveProfileSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
