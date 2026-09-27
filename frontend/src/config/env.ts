// The single place the app reads environment configuration.
//
// Metro only inlines `process.env.EXPO_PUBLIC_*` when it is accessed
// statically, so each variable is read by its full literal name below rather
// than through a dynamic lookup.

function normalizeBaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  // Deliberately a regex rather than `new URL()`: React Native's URL support is
  // only partial, and all we need is "http(s)://something".
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) return null

  return trimmed.replace(/\/+$/, '')
}

function normalizeNonEmpty(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

export const env = {
  /**
   * Base URL of the V2 backend, without a trailing slash — or `null` when it is
   * unset/invalid. There is intentionally no silent `localhost` fallback (the V1
   * web app had one and it can quietly point a production build at localhost).
   * The API client turns `null` into an explicit `ApiConfigError` on first use,
   * so the app shell still runs without a backend.
   */
  apiUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_API_URL),

  /**
   * Supabase project URL and anon (publishable) key. Both are meant to be public —
   * `EXPO_PUBLIC_*` is correct for them, same as API_CONTRACT.md §9 documents for the
   * Express backend's own `.env`. Row Level Security is what actually protects data,
   * not secrecy of these values. NEVER add `SUPABASE_SERVICE_ROLE_KEY` or any other
   * secret key here — the client has no legitimate use for one.
   */
  supabaseUrl: normalizeBaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: normalizeNonEmpty(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
} as const
