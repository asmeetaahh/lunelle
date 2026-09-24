/**
 * Response helpers — the only way a route writes a body.
 *
 * Success envelope (API_CONTRACT.md §5, G4):  { success: true, data }
 * Failure envelope:                            { success: false, code, message, details? }
 *
 * V1's spread-field format ({ success: true, periods: [...] }) is not
 * representable through these helpers on purpose.
 */

/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {number} [status=200]
 */
export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {number} [status=201]
 */
export function created(res, data, status = 201) {
  return ok(res, data, status)
}

/** @param {import('express').Response} res */
export function noContent(res) {
  return res.status(204).end()
}

/**
 * Write a failure envelope. `details` is omitted from the body when undefined.
 * 401 responses carry `WWW-Authenticate: Bearer` (matches requireAuth).
 *
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code      an API_ERROR_CODES value
 * @param {string} message
 * @param {unknown} [details]
 */
export function fail(res, status, code, message, details) {
  const body = { success: false, code, message }
  if (details !== undefined) body.details = details
  if (status === 401) res.set('WWW-Authenticate', 'Bearer')
  return res.status(status).json(body)
}
