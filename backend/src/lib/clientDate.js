/**
 * "Today" for date-sensitive requests.
 *
 * The frozen contract has the client send device-local calendar dates, but
 * the CycleEventInput / DailyObservationInput bodies carry no "today" field.
 * So:
 *   - If the request carries `X-Client-Date: YYYY-MM-DD`, that is today, exactly.
 *   - Otherwise the server's UTC calendar date is today, and "not in the future"
 *     checks allow one extra day, because a device at UTC+14 can be a calendar
 *     day ahead of the server.
 *
 * Engines never see this; it is an API-layer concern only.
 */
import { isISODate } from '../engines/cycle.js'
import { ApiError } from '../middleware/errorHandler.js'

export const CLIENT_DATE_HEADER = 'x-client-date'

const DAY_MS = 86_400_000

/** Calendar arithmetic for the API layer (UTC). */
export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * @param {import('express').Request} req
 * @param {{ now?: () => Date }} [deps]
 * @returns {{ today: string, latestAllowed: string, source: 'header' | 'server' }}
 */
export function clientDate(req, { now = () => new Date() } = {}) {
  const header = req.get(CLIENT_DATE_HEADER)
  if (header !== undefined && header !== '') {
    if (!isISODate(header)) {
      throw new ApiError('validation_error', `${CLIENT_DATE_HEADER} must be a real calendar date (YYYY-MM-DD)`, [
        { in: 'headers', path: CLIENT_DATE_HEADER, message: 'must be YYYY-MM-DD' },
      ])
    }
    return { today: header, latestAllowed: header, source: 'header' }
  }
  const today = now().toISOString().slice(0, 10)
  return { today, latestAllowed: addDays(today, 1), source: 'server' }
}

/** Throw the contract validation error when `date` is later than the latest allowed day. */
export function assertNotFuture(date, latestAllowed, location, path) {
  if (date > latestAllowed) {
    throw new ApiError('validation_error', `${path} cannot be in the future`, [{ in: location, path, message: 'must not be after today' }])
  }
}
