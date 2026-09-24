/**
 * Lunelle V2 — shared API interface.
 *
 * `LunelleApi` is the only thing a screen imports. The Expo app provides one
 * implementation of it; the Express backend implements the routes listed next
 * to each method. Two transports sit behind the interface:
 *
 *   auth.*          → Supabase Auth directly, via @supabase/supabase-js
 *   everything else → HTTPS to the Express API, with the Supabase access token
 *
 * Behavioural rules (part of the contract, binding on the implementation):
 *   1. Every Express call sends `Authorization: Bearer <current Supabase access token>`.
 *   2. On `invalid_token` the implementation refreshes the session once and retries
 *      once; if that fails it signs out and surfaces the error.
 *   3. Every non-2xx response becomes a thrown `ApiError`. Nothing else is thrown
 *      for HTTP outcomes.
 *   4. UI branches on `ApiError.code`, never on `message` text.
 *   5. `today.get` and `log.saveObservation` always receive the device-local
 *      calendar date. The engines have no clock.
 *   6. No screen imports @supabase/supabase-js; only the single API/auth
 *      implementation module does.
 *   7. No request body carries a user id. Identity is the token.
 *
 * GET /api/health is public and deliberately absent from this interface.
 */

import type {
  ApiErrorCode,
  AuthSession,
  CycleEvent,
  CycleEventInput,
  CycleSettings,
  CycleSettingsInput,
  DailyObservation,
  DailyObservationInput,
  ISODate,
  SubscriptionState,
  TodaySnapshot,
  UUID,
  YouSnapshot,
} from './types'

// ===========================================================================
// Routes — the backend mounts exactly these; the client builds URLs from them
// ===========================================================================

export const API_ROUTES = {
  /** Public. Not part of the authenticated API. */
  health: '/api/health',
  account: '/api/account',
  cycleSettings: '/api/cycle-settings',
  today: '/api/today',
  observations: '/api/observations',
  observation: (date: ISODate) => `/api/observations/${date}`,
  cycleEvents: '/api/cycle-events',
  cycleEvent: (id: UUID) => `/api/cycle-events/${id}`,
  you: '/api/you',
  subscription: '/api/subscription',
} as const

// ===========================================================================
// Inputs specific to the interface
// ===========================================================================

export interface EmailPasswordCredentials {
  email: string
  password: string
}

/** Sign-up may not yield a session when email confirmation is enabled on the project. */
export interface SignUpResult {
  session: AuthSession | null
  needsEmailConfirmation: boolean
}

/** Inclusive date range. Both ends optional; the API defaults to the last DEFAULT_OBSERVATION_RANGE_DAYS. */
export interface DateRange {
  from?: ISODate
  to?: ISODate
}

// ===========================================================================
// Error
// ===========================================================================

/** Thrown by the implementation for every non-2xx response (rule 3). */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: unknown

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Narrowing helper so screens can write `if (isApiError(e) && e.code === 'conflict')`. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

// ===========================================================================
// The interface
// ===========================================================================

export interface LunelleApi {
  /** Supabase Auth. No Express routes except deleteAccount. */
  auth: {
    signUp(credentials: EmailPasswordCredentials): Promise<SignUpResult>
    signIn(credentials: EmailPasswordCredentials): Promise<AuthSession>
    signOut(): Promise<void>
    getSession(): Promise<AuthSession | null>
    /** Fires on sign-in, sign-out and token refresh. Returns an unsubscribe function. */
    onAuthStateChange(listener: (session: AuthSession | null) => void): () => void
    /**
     * DELETE /api/account → 204. The API invokes a SECURITY DEFINER database
     * function that removes the auth user; all owned rows cascade. The
     * implementation then signs out locally.
     */
    deleteAccount(): Promise<void>
  }

  onboarding: {
    /** GET /api/cycle-settings → CycleSettings, or null when onboarding is incomplete. */
    getCycleSettings(): Promise<CycleSettings | null>
    /** PUT /api/cycle-settings — upsert; one row per user. */
    saveCycleSettings(input: CycleSettingsInput): Promise<CycleSettings>
  }

  today: {
    /** GET /api/today?date=<device-local ISODate> */
    get(date: ISODate): Promise<TodaySnapshot>
  }

  log: {
    /** PUT /api/observations/:date — idempotent upsert of the one observation for that day. */
    saveObservation(date: ISODate, input: DailyObservationInput): Promise<DailyObservation>
    /** GET /api/observations?from=&to= — ascending by date. */
    getObservations(range?: DateRange): Promise<DailyObservation[]>
    /** POST /api/cycle-events → 201. Duplicate (type, date) → ApiError 'conflict'. */
    logPeriodEvent(input: CycleEventInput): Promise<CycleEvent>
    /** DELETE /api/cycle-events/:id → 204. Unknown or not-owned id → ApiError 'not_found'. */
    deletePeriodEvent(id: UUID): Promise<void>
  }

  you: {
    /** GET /api/you */
    get(): Promise<YouSnapshot>
  }

  premium: {
    /** GET /api/subscription — always returns a row; isPlus=false by default. */
    getSubscription(): Promise<SubscriptionState>
  }
}
