// Transport-only HTTP client for the Lunelle V2 Express API. It knows how to
// build a URL, attach a bearer token, refresh-and-retry once on an expired
// token, apply a timeout, unwrap the contract's envelope and raise typed
// errors. It knows nothing about individual endpoints or their data shapes —
// those live in sibling modules (`today.ts`, `auth.ts`, …) built on top of it.
//
// Envelope and error handling follow `shared/api.ts` exactly:
//   success  { success: true, data }               → resolves with `data`
//   failure  { success: false, code, message, … }   → throws `ApiError` from `@shared/api`
//   401 with code 'invalid_token', on an authenticated request → refresh the
//     access token once and retry the same request once; if that also fails,
//     sign out and throw. Never retried more than once.
//
// Deliberately free of React Native / Expo imports so it stays portable and
// unit-testable; the app-specific wiring (Supabase, SecureStore) lives in
// `./index.ts` and `../auth`.

import { ApiError } from '@shared/api'
import type { ApiFailure, ApiResponse } from '@shared/types'

import { NetworkError } from './errors'

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
   * Attach the bearer token and allow the refresh-and-retry-once flow
   * (default `true`). Set to `false` for routes with no session to attach —
   * there are none in the current contract (every route but the
   * non-contractual `/api/health` requires auth), but the option stays
   * available rather than hard-coding that assumption into the transport.
   */
  auth?: boolean
  timeoutMs?: number
}

export interface ApiClientConfig {
  /** Resolved per request so a missing value fails at call time, not at import time. */
  getBaseUrl: () => string
  getAccessToken: () => Promise<string | null>
  /**
   * Forces a token refresh and returns the new access token, or `null` if the
   * refresh itself failed. Called at most once per request, only after a 401
   * with code `invalid_token`.
   */
  refreshAccessToken: () => Promise<string | null>
  /** Invoked once a refresh-then-retry has also failed with 401, before the error is thrown. */
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

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    // A non-JSON body (e.g. an upstream proxy's HTML error page) is not the
    // documented contract, but reporting it as-is beats crashing on .json().
    return text
  }
}

function isApiFailure(body: unknown): body is ApiFailure {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { code?: unknown }).code === 'string' &&
    typeof (body as { message?: unknown }).message === 'string'
  )
}

function toApiError(status: number, body: unknown): ApiError {
  if (isApiFailure(body)) {
    return new ApiError(status, body.code, body.message, body.details)
  }
  // The response was a non-2xx that didn't match the documented failure
  // envelope (a proxy/infra error, most likely) — still a real ApiError, with
  // whatever we have. 'internal' is the closest documented code for "the
  // server did not answer in the shape the contract promises."
  return new ApiError(status, 'internal', `Request failed with status ${status}`, body)
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  async function performFetch(
    path: string,
    options: RequestOptions,
    token: string | null,
  ): Promise<{ response: Response; parsed: unknown }> {
    const { method = 'GET', query, body, headers = {}, signal, timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS } =
      options

    const url = buildUrl(config.getBaseUrl(), path, query)

    const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
    if (token) requestHeaders.Authorization = `Bearer ${token}`

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
      throw new NetworkError(timedOut ? 'The request timed out.' : 'Could not reach the server.', {
        cause,
        timedOut,
      })
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 204) return { response, parsed: undefined }

    return { response, parsed: await parseJson(response) }
  }

  async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true } = options

    const initialToken = auth ? await config.getAccessToken() : null
    let { response, parsed } = await performFetch(path, options, initialToken)

    // Refresh-and-retry-once (shared/api.ts rule 2), scoped to exactly the
    // condition the contract names: a 401 whose code is specifically
    // 'invalid_token'. 'missing_authorization' / 'malformed_authorization' are
    // client bugs a refreshed token cannot fix, and retrying them would just
    // repeat the same malformed request.
    if (auth && response.status === 401 && isApiFailure(parsed) && parsed.code === 'invalid_token') {
      const refreshedToken = await config.refreshAccessToken()
      if (refreshedToken) {
        ;({ response, parsed } = await performFetch(path, options, refreshedToken))
      }
      if (response.status === 401) {
        config.onUnauthorized?.()
      }
    }

    if (response.status === 204) return undefined as T
    if (!response.ok) throw toApiError(response.status, parsed)

    const envelope = parsed as ApiResponse<T>
    if (!envelope || envelope.success !== true) {
      // A 2xx that isn't { success: true, data } is a contract violation, not
      // a normal failure — surfaced as ApiError('internal', …) rather than
      // silently returning something callers didn't ask for.
      throw new ApiError(response.status, 'internal', 'Response body did not match the success envelope.', parsed)
    }
    return envelope.data
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
