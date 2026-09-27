import type { ISODate } from '@shared/types'

/**
 * Today's date as the device sees it — `YYYY-MM-DD` in local time, not UTC.
 *
 * `Date#toISOString()` is UTC and is the wrong tool here: for a device east of
 * Greenwich, late evening is already "tomorrow" in UTC, which would send the
 * backend a date that hasn't started yet on the device. The engines have no
 * clock (shared/api.ts rule 5) — this is the one clock read the app does, and
 * it is *only* "what day is it", never cycle math.
 */
export function getDeviceLocalISODate(): ISODate {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
