// Session shape and its persistence in SecureStore.
//
// PROVISIONAL: `Session` is the minimum needed to carry a JWT for a Supabase
// Auth-compatible backend. Replace it with the backend contract's session/token
// type once that is available, rather than growing this one.

import { secureStorage } from '../storage/secureStorage'

export interface Session {
  accessToken: string
  refreshToken?: string
  /** Access-token expiry, epoch seconds. Not acted on yet (no refresh flow). */
  expiresAt?: number
}

const SESSION_KEY = 'session'

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.accessToken === 'string' &&
    record.accessToken.length > 0 &&
    (record.refreshToken === undefined || typeof record.refreshToken === 'string') &&
    (record.expiresAt === undefined || typeof record.expiresAt === 'number')
  )
}

/** Returns the stored session, or `null` if none / unreadable / malformed. Never throws. */
export async function loadSession(): Promise<Session | null> {
  const raw = await secureStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveSession(session: Session): Promise<void> {
  await secureStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export async function clearSession(): Promise<void> {
  await secureStorage.removeItem(SESSION_KEY)
}
