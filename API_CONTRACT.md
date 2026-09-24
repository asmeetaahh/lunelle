# Lunelle V2 API Contract

**Status:** authoritative for V2. Supersedes the V1 contract in full (see §13).
**Source of truth for shapes:** [`shared/types.ts`](shared/types.ts), [`shared/api.ts`](shared/api.ts), [`shared/constants.ts`](shared/constants.ts). This document explains and constrains those files; if the two ever disagree, `/shared` wins and this document is wrong.

---

## 1. Architecture

```
Expo app
  │  supabase-js: sign up / sign in / sign out / session
  ▼
Supabase Auth  ──issues──▶  access token (JWT)
  │
  │  Authorization: Bearer <access token>
  ▼
Express API (backend/)
  │  requireAuth → per-request Supabase client scoped to the caller's JWT
  │  engines/    → pure, deterministic cycle + pattern maths (no clock, no I/O)
  ▼
Supabase Postgres — Row Level Security on every user-owned table
```

- The app never talks to Postgres and never talks to an LLM. Every data operation goes through the Express API.
- The API never bypasses RLS for a user request. The service-role key is reserved for the RevenueCat webhook (writes `subscription_state` only).
- Identity is always the verified token. No request body, query string, or header carries a user id as an identity mechanism.

---

## 2. `/shared` is the single source of truth

| File | Contains |
|---|---|
| `shared/constants.ts` | Every closed value set (`SYMPTOMS`, `PHASES`, `CONFIDENCE_TIERS`, `CYCLE_EVENT_TYPES`, `API_ERROR_CODES`, …) and every numeric bound (`MOOD_SCALE`, `CYCLE_LENGTH_RANGE`, `TEXT_LIMITS`, …). Each mirrors a CHECK constraint in the migration or a constant in `backend/src/engines/`. |
| `shared/types.ts` | Entity, engine, envelope and screen-snapshot types, sectioned `[DB]` / `[ENGINE]` / `[API]` / `[UI]`. Unions are derived from `constants.ts`. |
| `shared/api.ts` | `LunelleApi` (the only thing a screen imports), `API_ROUTES`, `ApiError`, `isApiError`, and the seven behavioural rules. |

Rules:
- A contract change is made in `/shared` first, then reflected here, then in a migration if the database is affected.
- No other location may define these types or lists. `/contracts`, per-app copies, and generated Supabase types are not contract sources.
- The backend imports its validation bounds and vocabularies from `/shared`; it does not restate them.

---

## 3. Frozen decisions (G1–G10)

| # | Decision | Where it lives |
|---|---|---|
| G1 | Account deletion runs through a `SECURITY DEFINER` database function (`public.delete_own_account()`) invoked with the caller's own token. No service-role use. | `supabase/migrations/20260913150000_delete_own_account.sql`, `LunelleApi.auth.deleteAccount` |
| G2 | Journal remains in V2. Standalone generic AI chat is removed. | `JournalEntry` / `JournalEntryInput` in `types.ts`; no chat route anywhere |
| G3 | Screen data is served by composite endpoints: `GET /api/today` and `GET /api/you`. | `TodaySnapshot`, `YouSnapshot` |
| G4 | Success envelope is `{ success: true, data }`. Failure envelope is `ApiFailure`. | §5 |
| G5 | Periods are recorded as discrete events: `period_start` and `period_end`. There is no "duration" field. | `cycle_events`, `CycleEvent` |
| G6 | Mood and energy are integer scales 1–5 (labels in §7.2). | `MOOD_SCALE`, `ENERGY_SCALE`, `daily_observations` |
| G7 | The symptom vocabulary is exactly `SYMPTOMS` in `constants.ts`, which equals the migration's `is_valid_symptom_list()`. | §7.3 |
| G8 | Premium is enforced server-side: a gated route returns HTTP 403 with code `premium_required`. The client hides UI but is never the enforcement point. | §7.4 |
| G9 | `/shared` is the single contract location. | §2 |
| G10 | Forecasts are persisted as snapshots in `forecasts`. A fabricated/default forecast is never persisted and never returned as a prediction. | §7.5 |

---

## 4. Authentication

### 4.1 Session (Supabase Auth, via `supabase-js` inside the API layer only)

| `LunelleApi.auth` method | Backed by |
|---|---|
| `signUp({ email, password })` → `SignUpResult` | `supabase.auth.signUp`. `session` may be `null` when email confirmation is enabled; `needsEmailConfirmation` says so. |
| `signIn({ email, password })` → `AuthSession` | `supabase.auth.signInWithPassword` |
| `signOut()` | `supabase.auth.signOut` |
| `getSession()` → `AuthSession \| null` | current session |
| `onAuthStateChange(listener)` → unsubscribe | fires on sign-in, sign-out, token refresh |
| `deleteAccount()` | `DELETE /api/account` (§6.2), then local sign-out |

`AuthSession` exposes only `{ userId, email }`. The access token never leaves the API implementation module. No screen imports `@supabase/supabase-js`.

### 4.2 Bearer authentication (mandatory on every Express route except `/api/health`)

```
Authorization: Bearer <Supabase access token>
```

Server behaviour (`backend/src/middleware/requireAuth.js`):

| Condition | Status | `code` |
|---|---|---|
| No `Authorization` header | 401 | `missing_authorization` |
| Header is not `Bearer <single-token>` | 401 | `malformed_authorization` |
| Token rejected by Supabase Auth (invalid, expired, revoked) | 401 | `invalid_token` |
| Supabase Auth unreachable | 503 | `auth_unavailable` |

Every 401 carries `WWW-Authenticate: Bearer`. The token is never echoed in a response. On success the request runs with a Supabase client scoped to that token, so Postgres enforces RLS with `auth.uid()` = the caller.

Client behaviour: on `invalid_token`, refresh the session once and retry once; if that fails, sign out and surface the error.

---

## 5. Envelope and errors (G4)

Success — every 2xx with a body:

```json
{ "success": true, "data": <T> }
```

`204 No Content` responses (`DELETE`) have no body.

Failure — every non-2xx:

```json
{ "success": false, "code": "<ApiErrorCode>", "message": "<human-readable>", "details": <optional> }
```

| `code` | HTTP | Meaning |
|---|---|---|
| `missing_authorization` | 401 | see §4.2 |
| `malformed_authorization` | 401 | see §4.2 |
| `invalid_token` | 401 | see §4.2 |
| `auth_unavailable` | 503 | see §4.2 |
| `validation_error` | 400 | request body/params failed validation; `details` may carry field errors |
| `not_found` | 404 | resource does not exist **or is not owned by the caller** (RLS makes both indistinguishable by design) |
| `conflict` | 409 | uniqueness violation (e.g. same `cycle_events` type + date twice) |
| `premium_required` | 403 | route is Plus-gated and the caller is not Plus (G8) |
| `rate_limited` | 429 | too many requests |
| `internal` | 500 | unexpected server error; no internals leaked |

The client turns every non-2xx into a thrown `ApiError { status, code, message, details }`. UI branches on `code`, never on `message`.

---

## 6. Routes

All paths come from `API_ROUTES` in `shared/api.ts`. Nothing else is mounted for users. Request and response types are the exported names from `shared/types.ts`.

Conventions:
- Wire format is camelCase. Dates about a *day* are `ISODate` (`YYYY-MM-DD`); dates about a *moment* are `ISOTimestamp` (RFC 3339 UTC).
- `today.get` and `log.saveObservation` receive the **device-local** calendar date. The engines have no clock.
- `PUT` bodies are partial merges: an omitted key leaves the stored value unchanged; an explicit `null` clears it.

### 6.1 `GET /api/health` — public

Not part of the authenticated user API. Liveness only; response shape is not contractual.

### 6.2 `DELETE /api/account` — G1

Calls `public.delete_own_account()` through the caller-scoped client. Deletes the caller's `auth.users` row; all owned rows cascade. Returns `204`. Not reversible.

### 6.3 Onboarding — `cycle-settings`

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/api/cycle-settings` | — | `CycleSettings \| null` (`null` = onboarding incomplete) |
| `PUT` | `/api/cycle-settings` | `CycleSettingsInput` | `CycleSettings` |

- One row per user; `PUT` upserts.
- Bounds: `reportedCycleLength` within `CYCLE_LENGTH_RANGE` (15–60), `reportedPeriodLength` within `PERIOD_LENGTH_RANGE` (1–14).
- **Side effect:** when `lastPeriodStart` is set, the API also inserts a `cycle_events` row `{ type: 'period_start', date: lastPeriodStart }` (idempotent — an existing identical event is not an error). The engine reads events, never `lastPeriodStart`.

### 6.4 Today — G3

| Method | Path | Query | Response `data` |
|---|---|---|---|
| `GET` | `/api/today` | `date=<ISODate>` (required, device-local) | `TodaySnapshot` |

`TodaySnapshot` fields and guarantees:

| Field | Guarantee |
|---|---|
| `date` | echo of the query |
| `hasCycleSettings` | `false` → the client routes to onboarding |
| `position` | `CyclePosition`; `cycleDay: null` and `phase: 'unknown'` when there is no `period_start` history |
| `nextPeriod` | `PredictedPeriod \| null`. **Always a window** (`earliestStart ≤ expectedStart ≤ latestStart`) with `confidence`. `null` whenever no legitimate basis exists (§7.5). |
| `forecastBasis` | `ForecastBasis \| null`; `null` exactly when `nextPeriod` is `null` |
| `caveats` | plain-language notes; the client must render them whenever non-empty |
| `loggedDays.total` | distinct days with a daily observation, all time |
| `loggedDays.last30` | distinct days with a daily observation in the 30 days ending on `date`, inclusive |
| `todayObservation` | the `DailyObservation` for `date`, or `null` |

### 6.5 Log

| Method | Path | Body / Query | Response |
|---|---|---|---|
| `PUT` | `/api/observations/:date` | `DailyObservationInput` | `200` `DailyObservation` |
| `GET` | `/api/observations` | `from`, `to` (optional `ISODate`; default last `DEFAULT_OBSERVATION_RANGE_DAYS` = 90) | `200` `DailyObservation[]`, ascending by date |
| `POST` | `/api/cycle-events` | `CycleEventInput` | `201` `CycleEvent` |
| `DELETE` | `/api/cycle-events/:id` | — | `204` |

- One observation per user per day; `PUT` upserts on `(user, date)`.
- `symptoms` must be unique values from `SYMPTOMS`, at most `MAX_SYMPTOMS_PER_DAY` (20). `note` ≤ `TEXT_LIMITS.observationNote` (500).
- `POST /api/cycle-events` with an existing `(type, date)` → `409 conflict`.
- `DELETE /api/cycle-events/:id` for an unknown or not-owned id → `404 not_found`.

### 6.6 You — G3

| Method | Path | Response `data` |
|---|---|---|
| `GET` | `/api/you` | `YouSnapshot` |

- `stats`: `CycleStats` (§7.5).
- `cycles`: `CycleSummary[]`, newest first, derived from `cycle_events`. `periodLength` is `null` when no `period_end` was logged for that cycle.
- `patterns`: `PatternAssessment[]` with `tier ≠ 'none'`, ordered `established → likely → emerging` (§8).

### 6.7 Premium — G8

| Method | Path | Response `data` |
|---|---|---|
| `GET` | `/api/subscription` | `SubscriptionState` |

A row always exists (created at signup with `isPlus: false`). Users cannot write it; the RevenueCat webhook does.

### 6.8 Journal — G2

Journal is in V2. Its entity and input types (`JournalEntry`, `JournalEntryInput`) are in `shared/types.ts` and its table exists. **Its routes are not yet declared in `API_ROUTES`/`LunelleApi`** and are therefore not part of this contract version; they will be added to `/shared` first (additive, non-breaking), then documented here. No generic chat endpoint will be added (G2).

---

## 7. Domain rules

### 7.1 Cycle events (G5)

- `type` ∈ `CYCLE_EVENT_TYPES` = `period_start | period_end`.
- One event of each type per day per user.
- A cycle is the span from one `period_start` to the day before the next `period_start`. `period_end` is optional and only informs `periodLength`.
- All dates are constrained to `DATE_BOUNDS` (2000-01-01 … 2100-12-31) at the database; "not in the future" is validated by the API against the device-local date.

### 7.2 Mood and energy scales (G6)

Both are integers 1–5 or `null` (not answered). Labels are part of the contract so evidence text and pickers agree:

| Value | Mood label | Energy |
|---|---|---|
| 1 | Very low | Very low |
| 2 | Low | Low |
| 3 | Neutral | Neutral |
| 4 | Good | Good |
| 5 | Very good | Very good |

### 7.3 Symptom vocabulary (G7)

Exactly `SYMPTOMS` from `shared/constants.ts`, in this order, and exactly what `public.is_valid_symptom_list()` accepts:

`cramps`, `headache`, `bloating`, `fatigue`, `breast_tenderness`, `acne`, `back_pain`, `nausea`, `cravings`, `insomnia`, `spotting`, `mood_swings`, `anxiety`, `irritability`, `low_libido`, `high_libido`, `diarrhea`, `constipation`, `hot_flashes`, `dizziness`

Adding a value requires, in order: `constants.ts`, a migration replacing `is_valid_symptom_list()`, this section.

### 7.4 Premium enforcement (G8)

- Enforcement point: the Express route, before any data is returned. Response: `403 { success:false, code:'premium_required' }`.
- The client may hide or lock UI based on `SubscriptionState.isPlus`, but a hidden control is not enforcement.
- Gated capabilities are listed here and nowhere else. **Current list: none.** Until a capability is added to this list, no route returns `premium_required`.

### 7.5 Forecasts (G10)

**Engine contract** (`backend/src/engines/cycle.js`, types in `shared/types.ts`):
- `CycleStats.lengthSource` says where the typical cycle length came from: `history` (≥ 3 completed cycles), `reported` (user's onboarding value), `default` (neither — the engine's built-in constant).
- A prediction is always a `PredictedPeriod` window with `confidence`, never a bare date. `uncertaintyDays` never decreases with `ordinal` or with irregularity.

**Persisted snapshots.** When the API produces a prediction it records a row in `forecasts`:

| Column | From |
|---|---|
| `window_start`, `window_end`, `expected_period_date` | `PredictedPeriod.earliestStart / latestStart / expectedStart` |
| `period_uncertainty_days` | `PredictedPeriod.uncertaintyDays` |
| `window_offset_uncertainty_days` | extra slack applied for irregular history (0 when none) |
| `basis` | `history → observed_cycle`, `reported → user_reported`; `calibrated` is reserved for a future variability-adjusted model |
| `generated_at` | server time of computation |
| `model_version` | identifier of the engine version that produced the row (e.g. `cycle-1`). Required on every snapshot so a change in engine behaviour is auditable. *The initial migration lacks this column; it is added by an additive follow-up migration before the first snapshot is written.* |

Snapshots are written through the caller-scoped client (owner RLS), never with the service role. The API must not write a snapshot identical to the user's most recent one (same window, basis, and model version).

**Rule: no fabricated forecasts.** When `lengthSource === 'default'`, or when there is no `period_start` history at all:
- `TodaySnapshot.nextPeriod` is `null` and `forecastBasis` is `null`;
- **nothing is written to `forecasts`**;
- `caveats` explains what is missing.

`default` therefore never maps to a `ForecastBasis` and never reaches the database.

**No cycle settings vs. insufficient history** — these are different states and the client must treat them differently:

| State | Detected by | `nextPeriod` | `position` | Client action |
|---|---|---|---|---|
| No cycle settings | `hasCycleSettings: false` | `null` | `phase: 'unknown'` unless `period_start` events exist | Route to onboarding |
| Settings, no `period_start` history | `hasCycleSettings: true`, `stats.sampleSize = 0`, `stats.lastPeriodStart = null` | `null` | `cycleDay: null`, `phase: 'unknown'` | Prompt to log a period |
| Settings + history, fewer than 3 completed cycles | `stats.regularity: 'insufficient'`, `lengthSource: 'reported'` | window from reported length, `confidence: 'low'`, `forecastBasis: 'user_reported'` | `isEstimated: true` | Show window + caveat |
| ≥ 3 completed cycles | `lengthSource: 'history'` | window from observed cycles, `forecastBasis: 'observed_cycle'`, confidence from regularity | `isEstimated: false` | Show window; irregular history caps confidence at `low` and adds a caveat |

---

## 8. Patterns (evidence-backed, non-causal)

- Produced by `backend/src/engines/patternConfidence.js`, persisted to `pattern_evidence` only when `tier ≠ 'none'`.
- Tiers (`CONFIDENCE_TIERS`) are earned by counting recurrences across cycles against fixed thresholds on `supportingCycles` and `consistency`. Missing data lowers confidence; it is never treated as "did not occur".
- Every `PatternAssessment` carries `evidence: CycleEvidence[]` — the exact `observedOn` dates and `cycleDays` per cycle — so every tier is traceable to rows in `daily_observations` and `cycle_events`.
- `summary` is built only from the engine's fixed templates. It reports counts and timing, never mechanism. No field may express a cause, and no AI-generated prose is stored as pattern truth.

---

## 9. Environment

Backend (`backend/.env`, validated at boot by `backend/src/config/env.js`; values are never logged):

```
PORT=5001
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # RevenueCat webhook only
REVENUECAT_WEBHOOK_SECRET=
AI_API_KEY=
```

Expo app (public by design; RLS is the protection, not secrecy of these values):

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Never place `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_WEBHOOK_SECRET`, or `AI_API_KEY` in the app.

---

## 10. Database

- Schema: `supabase/migrations/20260913140000_v2_initial_schema.sql` (tables, RLS, grants, triggers) and `20260913150000_delete_own_account.sql` (G1).
- Every user-owned table: `user_id → auth.users ON DELETE CASCADE`, RLS enabled **and forced**, four owner policies for `authenticated`, no `anon` grants.
- `subscription_state`: `SELECT` only for users; no insert/update/delete policy or grant.
- `profiles` and `subscription_state` rows are created by a trigger on `auth.users` insert.
- Database tests: `backend/test/db/` (`npm run test:db`).

---

## 11. Client implementation rules (from `shared/api.ts`)

1. Every Express call sends the current Supabase access token as a bearer.
2. On `invalid_token`: refresh once, retry once, then sign out.
3. Every non-2xx becomes a thrown `ApiError`.
4. Branch on `ApiError.code`, never on message text.
5. Send the device-local `ISODate` for today/log operations.
6. Only the single API/auth implementation module imports `@supabase/supabase-js`.
7. No request body carries a user id.

---

## 12. Change process

1. Edit `/shared` (types, constants, routes).
2. If the database changes, add a **new** migration; never edit an applied one.
3. Update this document.
4. Update `backend/test/` and `backend/test/db/`.

A change that alters an existing field's meaning or removes a field is breaking and needs both team members' agreement. Adding optional fields, routes, or enum values is additive.

---

## 13. Removed from V1 (not part of V2)

| V1 contract | Status |
|---|---|
| Anonymous, unauthenticated endpoints | Removed — bearer auth is mandatory |
| `{ success: true, ...spread }` envelope | Removed — `{ success, data }` (G4) |
| `POST /api/periods { startDate, duration }`, `GET /api/periods`, `DELETE /api/periods/:id` | Removed — `cycle_events` start/end (G5) |
| `GET /api/periods/prediction`, `GET /api/dashboard` (bare `nextPeriodDate`, `daysUntilNextPeriod`, `averageCycleLength`) | Removed — `GET /api/today` with a window + confidence (G3, G10) |
| `POST /api/moods` / `GET /api/moods` with `happy/calm/sad/angry/stressed/lonely` | Removed — `daily_observations` 1–5 scales + symptoms (G6, G7) |
| `POST /api/chat` | Removed (G2) |
| Phase value `ovulation` | Replaced by `ovulatory` |
| `VITE_API_URL`, `DATABASE_URL`, port 5000, CORS for `localhost:5173` | Replaced by §9 |
| Static SPA serving from the backend | Removed — the backend is a JSON API only |
