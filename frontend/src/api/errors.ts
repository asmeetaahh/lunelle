// Errors thrown by the API client. Callers distinguish them with `instanceof`.

/** The backend answered, but with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number
  /** Parsed JSON body when there was one, otherwise the raw text, otherwise undefined. */
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(extractMessage(body) ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** No usable response: offline, DNS/TLS failure, or the request timed out. */
export class NetworkError extends Error {
  readonly timedOut: boolean

  constructor(message: string, options: { cause?: unknown; timedOut?: boolean } = {}) {
    super(message, { cause: options.cause })
    this.name = 'NetworkError'
    this.timedOut = options.timedOut ?? false
  }
}

/** The app is misconfigured (e.g. `EXPO_PUBLIC_API_URL` is missing). A developer problem, not a user one. */
export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConfigError'
  }
}

// PROVISIONAL: reads a human-readable message from `{ error }` / `{ message }`
// bodies purely as a convenience for `error.message`. The V2 error envelope is
// defined by the backend contract; replace this once that contract is available.
function extractMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null

  const record = body as Record<string, unknown>
  for (const key of ['error', 'message']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}
