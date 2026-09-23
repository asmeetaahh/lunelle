// Owns the auth state for the whole app. Everything else asks `useAuth()`;
// nothing else reads SecureStore or touches tokens.
//
// What is real here: restoring a persisted session on launch, persisting a new
// one, clearing on sign-out, handing the token to the API client, and signing
// out automatically when the API reports a 401.
//
// What is NOT here yet: the actual sign-in flow (Supabase Auth email/OTP/social
// vs. a backend-issued token) and token refresh. Both depend on the backend
// contract. When a real sign-in exists it should end by calling `signIn(session)`.

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

import { configureApiAuth } from '../api'
import { clearSession, loadSession, saveSession, type Session } from './session'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

interface AuthContextValue {
  status: AuthStatus
  /** `null` when signed out or in a preview session (which has no token). */
  session: Session | null
  /** True for the dev-only preview session: signed "in" for navigation, but with no token. */
  isPreview: boolean
  signIn: (session: Session) => Promise<void>
  signOut: () => Promise<void>
  /** Dev builds only: enter the app shell without a backend. Never persisted, never sends a token. */
  startPreviewSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [isPreview, setIsPreview] = useState(false)

  // The API client reads the token through this ref so it always sees the
  // latest session without the client being re-created or re-configured.
  const sessionRef = useRef<Session | null>(null)

  const applySession = useCallback((next: Session | null, preview = false) => {
    sessionRef.current = next
    setSession(next)
    setIsPreview(preview)
    setStatus(next || preview ? 'signedIn' : 'signedOut')
  }, [])

  useEffect(() => {
    let cancelled = false

    void loadSession().then((stored) => {
      if (!cancelled) applySession(stored)
    })

    return () => {
      cancelled = true
    }
  }, [applySession])

  const signIn = useCallback(
    async (next: Session) => {
      await saveSession(next)
      applySession(next)
    },
    [applySession],
  )

  const signOut = useCallback(async () => {
    // Drop in-memory state first so the UI leaves the authenticated area
    // immediately, even if clearing the keychain is slow or fails.
    applySession(null)
    try {
      await clearSession()
    } catch (error) {
      if (__DEV__) console.warn('Could not clear the stored session:', error)
    }
  }, [applySession])

  const startPreviewSession = useCallback(() => {
    if (__DEV__) applySession(null, true)
  }, [applySession])

  useEffect(() => {
    configureApiAuth({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      onUnauthorized: () => {
        void signOut()
      },
    })
    return () => configureApiAuth(null)
  }, [signOut])

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, isPreview, signIn, signOut, startPreviewSession }),
    [status, session, isPreview, signIn, signOut, startPreviewSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an <AuthProvider>.')
  return context
}
