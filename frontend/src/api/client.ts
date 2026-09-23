// Transport-only HTTP client. It knows how to build a URL, attach a bearer
// token, apply a timeout, parse JSON and raise typed errors. It knows nothing
// about Lunelle's endpoints or data shapes — those belong to the backend
// contract and are added on top of this, never re-implemented here.
//
// Deliberately free of React Native / Expo / app imports so it stays portable
// and unit-testable; the app-specific wiring lives in ./index.ts.

import { ApiError, NetworkError } from './errors'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  method?: HttpMethod
  /** Appended as a query string. `null`/`undefined` values are omitted. */
  query?: Record<string, QueryValue>
  /** JSON-serialised. Omit for requests without a body. */
  body?: unknown
  headers?: Record<string, string>
  /** Caller cancellation. An aborted request rejects with the platform's own AbortError. */
  signal?: AbortSignal
  /**
   * Attach the bearer token and run the 401 handler (default `true`). Set to
   * `false` for public endpoints such as sign-in, where a 401 means "bad
   * credentials" rather than "your session expired".
   */
  auth?: boolean
  timeoutMs?: number
}

export interface ApiClientConfig {
  /** Resolved per request so a missing value fails at call time, not at import time. */
  getBaseUrl: () => string
  /** May be async so a future refresh-before-request flow can slot in. */
  getAccessToken: () => string | null | Promise<string | null>
  /** Invoked once on a 401 from an authenticated request, before the error is thrown. */
  onUnauthorized?: () => void
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Default per-request timeout. */
  timeoutMs?: number
}

type BodylessOptions = Omit<RequestOptions, 'method' | 'body'>

export interface ApiClient {
  request: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>
  get: <T = unknown>(path: string, options?: BodylessOptions) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, options?: BodylessOptions) => Promise<T>
  put: <T = unknown>(path: string, body?: unknown, options?: BodylessOptions) => Promise<T>
  patch: <T = unknown>(path: string, body?: unknown, options?: BodylessOptions) => Promise<T>
  delete: <T = unknown>(path: string, options?: BodylessOptions) => Promise<T>
}

const DEFAULT_TIMEOUT_MS = 15_000

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  if (!path.startsWith('/')) {
    throw new Error(`API paths must start with "/" (received "${path}").`)
  }

  const pairs: string[] = []
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  return `${baseUrl.replace(/\/+$/, '')}${path}${pairs.length ? `?${pairs.join('&')}` : ''}`
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      query,
      body,
      headers = {},
      signal,
      auth = true,
      timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    } = options

    const url = buildUrl(config.getBaseUrl(), path, query)

    const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'

    if (auth) {
      const token = await config.getAccessToken()
      if (token) requestHeaders.Authorization = `Bearer ${token}`
    }

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const doFetch = config.fetch ?? fetch

    let response: Response
    try {
      response = await doFetch(url, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (cause) {
      if (signal?.aborted) throw cause // caller cancelled: surface the AbortError untouched
      throw new NetworkError(
        timedOut ? 'The request timed out.' : 'Could not reach the server.',
        { cause, timedOut },
      )
    } finally {
      clearTimeout(timer)
    }

    const parsed = await parseBody(response)

    if (!response.ok) {
      if (response.status === 401 && auth) config.onUnauthorized?.()
      throw new ApiError(response.status, parsed)
    }

    // `T` is the caller's assertion about the response shape; nothing is
    // validated at runtime here.
    return parsed as T
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}
