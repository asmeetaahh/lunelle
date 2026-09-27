// Implements `LunelleApi['auth']`, minus `deleteAccount` (out of scope for
// this slice — it calls a real, destructive backend route and deserves its
// own task, not an incidental addition here).
//
// Backed entirely by `auth/supabaseClient.ts`, the one module that imports
// `@supabase/supabase-js`. This module is itself the boundary `shared/api.ts`
// rule 6 means by "the single API/auth implementation module" — `AuthProvider`
// wraps it for React; no screen imports the SDK directly, and this file is
// usable without React at all.
import type { AuthSession } from '@shared/types'
import type { EmailPasswordCredentials, SignUpResult } from '@shared/api'

import {
  getCurrentAuthSession,
  onAuthStateChange as onSupabaseAuthStateChange,
  signInWithPassword,
  signOutSupabase,
  signUpWithPassword,
} from '../auth/supabaseClient'

export const auth = {
  async signUp({ email, password }: EmailPasswordCredentials): Promise<SignUpResult> {
    return signUpWithPassword(email, password)
  },

  async signIn({ email, password }: EmailPasswordCredentials): Promise<AuthSession> {
    return signInWithPassword(email, password)
  },

  async signOut(): Promise<void> {
    return signOutSupabase()
  },

  async getSession(): Promise<AuthSession | null> {
    return getCurrentAuthSession()
  },

  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void {
    return onSupabaseAuthStateChange(listener)
  },
}
