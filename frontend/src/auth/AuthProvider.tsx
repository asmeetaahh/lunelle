// Owns the auth state for the whole app. Everything else asks `useAuth()`;
// nothing outside `supabaseClient.ts` touches Supabase or a token directly —
// this provider calls only the functions that module exports.
//
// Session persistence, restore and refresh are all owned by supabase-js
// itself (wired to SecureStore as its storage adapter in `supabaseClient.ts`)
// — this provider's job is exposing that state as React context and handing
// the API client a way to read/refresh the token and to sign out.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { AuthSession } from '@shared/types'

import { configureApiAuth } from '../api'
import {
  getAccessToken,
  getCurrentAuthSession,
  onAuthStateChange,
  refreshAccessToken,
  signInWithPassword,
  signOutSupabase,
  signUpWithPassword,
} from './supabaseClient'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface SignUpResult {
  session: AuthSession | null
  needsEmailConfirmation: boolean
}

interface AuthContextValue {
  status: AuthStatus
  /** `null` when signed out or in a preview session (which has no token). */
  session: AuthSession | null
  /** True for the dev-only preview session: signed "in" for navigation, but with no token. */
  isPreview: boolean
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Dev builds only: enter the app shell without a backend. Never persisted, never sends a token. */
  startPreviewSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isPreview, setIsPreview] = useState(false)

  // The API client reads/refreshes the token through these refs so it always
  // acts on the latest state without being re-created or re-configured.
  const isPreviewRef = useRef(false)

  const applySession = useCallback((next: AuthSession | null, preview = false) => {
    isPreviewRef.current = preview
    setSession(next)
    setIsPreview(preview)
    setStatus(next || preview ? 'signedIn' : 'signedOut')
  }, [])

  // Restore on launch, then stay in sync with sign-in/sign-out/token refresh.
  // supabase-js reads the persisted session from SecureStore itself; this
  // effect only mirrors what it reports into React state.
  useEffect(() => {
    let cancelled = false

    void getCurrentAuthSession().then((restored) => {
      if (!cancelled && !isPreviewRef.current) applySession(restored)
    })

    const unsubscribe = onAuthStateChange((next) => {
      if (!isPreviewRef.current) applySession(next)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [applySession])

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const result = await signUpWithPassword(email, password)
    // onAuthStateChange fires and updates state when a session comes back
    // immediately (email confirmation off); nothing to do here either way.
    return result
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    await signInWithPassword(email, password)
    // onAuthStateChange fires next and updates state — not applied here too,
    // so there is exactly one place session transitions are written.
  }, [])

  const signOut = useCallback(async () => {
    if (isPreviewRef.current) {
      applySession(null)
      return
    }
    try {
      await signOutSupabase()
      // onAuthStateChange fires SIGNED_OUT and clears state.
    } catch (error) {
      // Sign-out failing (e.g. offline) must not strand the user signed in
      // locally — drop local state regardless, same reasoning as before.
      if (__DEV__) console.warn('Supabase sign-out failed; clearing local session anyway:', error)
      applySession(null)
    }
  }, [applySession])

  const startPreviewSession = useCallback(() => {
    if (__DEV__) applySession(null, true)
  }, [applySession])

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => (isPreviewRef.current ? Promise.resolve(null) : getAccessToken()),
      refreshAccessToken: () => (isPreviewRef.current ? Promise.resolve(null) : refreshAccessToken()),
      onUnauthorized: () => {
        void signOut()
      },
    })
    return () => configureApiAuth(null)
  }, [signOut])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, isPreview, signUp, signIn, signOut, startPreviewSession }),
    [status, session, isPreview, signUp, signIn, signOut, startPreviewSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an <AuthProvider>.')
  return context
}
