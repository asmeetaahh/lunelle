import { fail } from '../lib/respond.js'
import { zodDetails } from './errorHandler.js'

const LOCATIONS = ['params', 'query', 'body']

/**
 * Zod validation middleware for request parts.
 *
 * Usage:
 *   router.put('/observations/:date', validate({ params: DateParams, body: ObservationInput }), handler)
 *
 * On success the parsed (coerced, stripped) values replace `req.params`,
 * `req.query`, `req.body`, and are also available as `req.validated`.
 * On failure the response is 400 `validation_error` with
 * `details: [{ in, path, message }]`; no stack traces, no raw input echoed.
 *
 * Authentication is NOT checked here — requireAuth owns that.
 *
 * @param {{ params?: import('zod').ZodType, query?: import('zod').ZodType, body?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  if (!schemas || typeof schemas !== 'object') throw new TypeError('validate() requires a schemas object')
  const entries = LOCATIONS.filter((location) => schemas[location] !== undefined).map((location) => {
    const schema = schemas[location]
    if (typeof schema?.safeParse !== 'function') throw new TypeError(`validate(): "${location}" must be a zod schema`)
    return [location, schema]
  })
  if (entries.length === 0) throw new TypeError('validate() needs at least one of params, query, body')

  return function validateRequest(req, res, next) {
    const details = []
    const validated = {}

    for (const [location, schema] of entries) {
      const result = schema.safeParse(req[location] ?? {})
      if (result.success) {
        validated[location] = result.data
      } else {
        details.push(...zodDetails(location, result.error.issues))
      }
    }

    if (details.length > 0) {
      return fail(res, 400, 'validation_error', 'Request validation failed', details)
    }

    req.validated = validated
    for (const location of Object.keys(validated)) {
      // req.query is a getter in Express 5; defineProperty works in both 4 and 5.
      Object.defineProperty(req, location, { value: validated[location], writable: true, configurable: true, enumerable: true })
    }
    return next()
  }
}
