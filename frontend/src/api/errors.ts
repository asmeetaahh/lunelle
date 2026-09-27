// Errors the API client throws that are NOT the contract's `ApiError`.
//
// `ApiError` itself — thrown for every non-2xx response, per `shared/api.ts`
// rule 3 — is the one exported from `@shared/api`. It is not redefined here:
// re-declaring it would create a second class a `catch` could mismatch against
// (`instanceof` cares which module the class came from), and the whole point
// of `/shared` is that both sides of the contract use the same one.
//
// The two below cover what the contract has no opinion on: failures that
// happen before or around an HTTP exchange, not a documented response to one.

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
