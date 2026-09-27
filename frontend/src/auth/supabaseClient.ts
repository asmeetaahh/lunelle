// The Supabase client, and everything that touches it directly.
//
// **This is the one file in the app that imports `@supabase/supabase-js`.**
// `shared/api.ts` rule 6: "No screen imports @supabase/supabase-js; only the
// single API/auth implementation module does." Everything else — AuthProvider,
// the API client, screens — goes through the functions exported here, or
// through `@shared/types`' `AuthSession` (`{ userId, email }`), and never
// touches a Supabase `Session` or its access token directly.
//
// Session persistence is SecureStore (`storage/secureStorage`), wired in as
// Supabase's own storage adapter below — supabase-js owns reading, writing and
// refreshing the session; nothing here hand-rolls that.
import 'react-native-url-polyfill/auto'

import { AppState } from 'react-native'
import { createClient, type Session } from '@supabase/supabase-js'

import type { AuthSession } from '@shared/types'

import { env } from '../config/env'
import { secureStorage } from '../storage/secureStorage'
import { ApiConfigError } from '../api/errors'

function requireSupabaseConfig(): { url: string; anonKey: string } {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new ApiConfigError(
      'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Copy frontend/.env.example to frontend/.env and fill them in, then restart Metro.',
    )
  }
  return { url: env.supabaseUrl, anonKey: env.supabaseAnonKey }
}

// Constructed lazily (not at import time) so an unconfigured dev build can
// still boot the app shell — the error surfaces the first time auth is
// actually used, the same pattern `api/index.ts` uses for the API base URL.
let client: ReturnType<typeof createClient> | null = null

function getClient() {
  if (!client) {
    const { url, anonKey } = requireSupabaseConfig()
    client = createClient(url, anonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No web OAuth redirect flow in a native app.
        detectSessionInUrl: false,
      },
    })

    // React Native has no page lifecycle to drive Supabase's refresh timer —
    // without this, a backgrounded app keeps "refreshing" on a timer it can't
    // act on, and a foregrounded app may sit on a stale token until the next
    // request fails. This is Supabase's own documented RN wiring.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client?.auth.startAutoRefresh()
      else void client?.auth.stopAutoRefresh()
    })
  }
  return client
}

/** `{ userId, email }` — the only session shape anything outside this file sees. */
export function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null
  return { userId: session.user.id, email: session.user.email ?? null }
}

/**
 * The current access token, or `null` if signed out. A local read (storage /
 * in-memory cache) — `getSession()` does not itself call the network.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getClient().auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Forces a refresh using the stored refresh token and returns the new access
 * token, or `null` if the refresh itself failed (e.g. the refresh token is
 * also invalid) — the API client's cue to sign out rather than retry again.
 * A successful refresh persists the new session and fires `onAuthStateChange`
 * the same as any other session change, so callers need not do anything else
 * with the return value beyond deciding whether to retry their request.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const { data, error } = await getClient().auth.refreshSession()
  if (error || !data.session) return null
  return data.session.access_token
}

export async function getCurrentAuthSession(): Promise<AuthSession | null> {
  const { data } = await getClient().auth.getSession()
  return toAuthSession(data.session)
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<{ session: AuthSession | null; needsEmailConfirmation: boolean }> {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw error
  return {
    session: toAuthSession(data.session),
    needsEmailConfirmation: data.session === null,
  }
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw error
  const session = toAuthSession(data.session)
  if (!session) throw new Error('Sign-in did not return a session.')
  return session
}

export async function signOutSupabase(): Promise<void> {
  const { error } = await getClient().auth.signOut()
  if (error) throw error
}

/** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe function. */
export function onAuthStateChange(listener: (session: AuthSession | null) => void): () => void {
  const {
    data: { subscription },
  } = getClient().auth.onAuthStateChange((_event, session) => {
    listener(toAuthSession(session))
  })
  return () => subscription.unsubscribe()
}
