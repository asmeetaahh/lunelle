import { fail } from '../lib/respond.js'

/**
 * Error codes the API may emit — mirrors API_ERROR_CODES in shared/constants.ts
 * (pinned by a test; the backend cannot import .ts at runtime in its current image).
 */
export const ERROR_CODES = Object.freeze([
  'missing_authorization',
  'malformed_authorization',
  'invalid_token',
  'auth_unavailable',
  'validation_error',
  'not_found',
  'conflict',
  'premium_required',
  'rate_limited',
  'internal',
])

/** Status each code maps to (API_CONTRACT.md §5). */
export const STATUS_FOR_CODE = Object.freeze({
  missing_authorization: 401,
  malformed_authorization: 401,
  invalid_token: 401,
  auth_unavailable: 503,
  validation_error: 400,
  not_found: 404,
  conflict: 409,
  premium_required: 403,
  rate_limited: 429,
  internal: 500,
})

/**
 * Server-side throwable that the error handler turns into a failure envelope.
 * Routes throw this (or pass it to next()) for any expected failure.
 */
export class ApiError extends Error {
  /**
   * @param {keyof typeof STATUS_FOR_CODE} code
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(code, message, details) {
    if (!ERROR_CODES.includes(code)) throw new TypeError(`unknown API error code "${code}"`)
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'ApiError'
    this.status = STATUS_FOR_CODE[code]
    this.code = code
    this.details = details
  }
}

const DEFAULT_MESSAGES = Object.freeze({
  missing_authorization: 'Authorization header is required',
  malformed_authorization: 'Authorization header must be "Bearer <token>"',
  invalid_token: 'Access token is invalid or expired',
  auth_unavailable: 'Authentication service is unavailable',
  validation_error: 'Request validation failed',
  not_found: 'Not found',
  conflict: 'Resource already exists',
  premium_required: 'This feature requires Lunelle Plus',
  rate_limited: 'Too many requests',
  internal: 'Internal server error',
})

/** Wrap an async route so a rejected promise reaches the error handler (Express 4 does not do this). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/**
 * Turn a zod issue list into contract `details`: [{ in, path, message }].
 * @param {string} location
 * @param {Array<{ path: PropertyKey[], message: string }>} issues
 */
export function zodDetails(location, issues) {
  return issues.map((issue) => ({
    in: location,
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }))
}

// --- Postgres / PostgREST error mapping ------------------------------------
// supabase-js returns { code, message, details, hint }. Only the code is used;
// message/details/hint can contain constraint names, column values or SQL and
// are never forwarded to the client.

const PG_CODE_MAP = Object.freeze({
  '23505': ['conflict', 'Resource already exists'],
  '23503': ['validation_error', 'Request references data that does not exist'],
  '23514': ['validation_error', 'Request contains a value the database does not accept'],
  '23502': ['validation_error', 'Request is missing a required value'],
  '22P02': ['validation_error', 'Request contains a malformed value'],
  '22007': ['validation_error', 'Request contains a malformed date'],
  '22008': ['validation_error', 'Request contains an out-of-range date'],
  // RLS refused the write (row not owned / would not be visible) — indistinguishable from absent by design.
  '42501': ['not_found', 'Not found'],
  // PostgREST: .single() matched zero (or several) rows.
  PGRST116: ['not_found', 'Not found'],
})

const isZodError = (err) => err?.name === 'ZodError' && Array.isArray(err.issues)
const isApiErrorLike = (err) =>
  err?.name === 'ApiError' && Number.isInteger(err.status) && typeof err.code === 'string' && ERROR_CODES.includes(err.code)
const isBodyParserError = (err) => typeof err?.type === 'string' && err.type.startsWith('entity.')

// --- Safe logging -------------------------------------------------------------

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const KEY_PATTERN = /\b(sb_(?:secret|publishable)_[A-Za-z0-9_-]+|sbp_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]{8,})\b/g
const ASSIGNMENT_PATTERN = /\b([A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z_]*)\s*[=:]\s*\S+/g

/** Mask anything that looks like a credential. Applied to everything that reaches a log line. */
export function redact(text) {
  return String(text)
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(KEY_PATTERN, '[redacted-key]')
    .replace(ASSIGNMENT_PATTERN, '$1=[redacted]')
}

/**
 * Build the final Express error handler.
 *
 * Never sends: stack traces, tokens, secrets, SQL or database internals.
 * Never logs: request bodies (health data) or unredacted messages.
 *
 * @param {{ logger?: { error: (...args: unknown[]) => void } }} [options]
 */
export function createErrorHandler({ logger = console } = {}) {
  // Four parameters are required for Express to treat this as an error handler.
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err)

    if (isApiErrorLike(err)) {
      return fail(res, err.status, err.code, err.message, err.details)
    }

    if (isZodError(err)) {
      return fail(res, 400, 'validation_error', DEFAULT_MESSAGES.validation_error, zodDetails(err.location ?? 'request', err.issues))
    }

    if (isBodyParserError(err)) {
      const message = err.type === 'entity.too.large' ? 'Request body exceeds the size limit' : 'Request body is not valid JSON'
      return fail(res, 400, 'validation_error', message)
    }

    const pg = PG_CODE_MAP[String(err?.code)]
    if (pg) {
      const [code, message] = pg
      return fail(res, STATUS_FOR_CODE[code], code, message)
    }

    logger.error(
      redact(
        JSON.stringify({
          level: 'error',
          event: 'unhandled_error',
          method: req.method,
          path: req.path,
          name: err?.name ?? typeof err,
          message: err?.message ?? String(err),
          code: err?.code,
          stack: err?.stack,
        }),
      ),
    )
    return fail(res, 500, 'internal', DEFAULT_MESSAGES.internal)
  }
}

/** Default instance for production wiring. */
export const errorHandler = createErrorHandler()
