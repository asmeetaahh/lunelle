// The app's one configured API client. Import `api` from here; never call
// `fetch` against the backend directly, and never read the base URL anywhere
// but `config/env.ts`.
//
// Endpoint functions (e.g. `getToday()`) and their request/response types are
// NOT defined yet — they come from the backend contract (`/shared`,
// `API_CONTRACT.md`) and will live in this folder once it is available.

import { env } from '../config/env'
import { createApiClient } from './client'
import { ApiConfigError } from './errors'

export { ApiError, ApiConfigError, NetworkError } from './errors'
export type { ApiClient, RequestOptions } from './client'

interface ApiAuthHooks {
  getAccessToken: () => string | null
  onUnauthorized?: () => void
}

let authHooks: ApiAuthHooks | null = null

/**
 * Called by the auth layer so this module needn't import it (which would make
 * the API and auth layers depend on each other). Pass `null` to detach.
 */
export function configureApiAuth(hooks: ApiAuthHooks | null): void {
  authHooks = hooks
}

function requireBaseUrl(): string {
  if (!env.apiUrl) {
    throw new ApiConfigError(
      'EXPO_PUBLIC_API_URL is not set (or is not an http(s) URL). Copy frontend/.env.example to frontend/.env and set it, then restart Metro.',
    )
  }
  return env.apiUrl
}

export const api = createApiClient({
  getBaseUrl: requireBaseUrl,
  getAccessToken: () => authHooks?.getAccessToken() ?? null,
  onUnauthorized: () => authHooks?.onUnauthorized?.(),
})
