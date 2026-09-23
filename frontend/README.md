# Lunelle V2 — Expo frontend

The React Native (Expo) app for Lunelle V2. It lives in `frontend/` and is fully
isolated from the rest of the repository.

| Path | What it is | Owner |
|---|---|---|
| `frontend/` | **This app** (Expo, Expo Router, TypeScript) | Frontend |
| `backend/`, `supabase/` | V2 API and database migrations | Backend |
| `shared/`, `API_CONTRACT.md` | The frozen frontend↔backend contract | Backend (read-only here) |
| `server/`, `src/`, root `package.json` | Legacy V1 (Vite web app + Express) | Untouched |

`frontend/` has its **own** `package.json` and `node_modules`. It is not a workspace
member and nothing here reads from or writes to the V1 app.

## Status: foundation only

What exists: routing and auth-gating, three placeholder tabs, an API client
foundation, environment config, a theme, and SecureStore-backed session storage.

What does **not** exist yet, on purpose: any real feature (Journal, AI, cycle
tracking UI, forecasts, patterns), RevenueCat, notifications, and a real sign-in
flow. See [Contract status](#contract-status).

## Running it

Requires Node 20+ and either the iOS Simulator, an Android emulator, or the Expo
Go app on a device.

```bash
cd frontend
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_URL (see below)
npm start                 # or: npm run ios / npm run android
```

The app shell runs without a backend. In development builds the Welcome screen
shows **"Continue without an account (dev preview)"**, which enters the tabs
without a session. That button does not exist in production builds.

### Scripts

| Script | Does |
|---|---|
| `npm start` / `ios` / `android` | Start Metro / open a simulator |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint with `eslint-config-expo` |
| `npm run check` | typecheck + lint |
| `npm run doctor` | `expo-doctor` project validation |

To verify the app bundles: `npx expo export --platform ios --platform android`
(writes to git-ignored `dist/`).

### Linting

The lint config is `eslint.frontend.config.mjs` and `npm run lint` passes it with
`-c`. It is intentionally **not** called `eslint.config.*`: the legacy V1 app's
`npm run lint` (`eslint .` at the repo root, ESLint 10) walks into this folder and would
pick up a config named that way, then crash — `eslint-config-expo`'s React plugin does
not support ESLint 10 yet. Without a discoverable config here, V1 lints exactly as
before. If your editor's ESLint extension doesn't find the config, point it at this file
(`eslint.options.overrideConfigFile`). Revisit once `eslint-config-expo` supports ESLint 10.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | for any API call | Base URL of the V2 backend. Read **only** in `src/config/env.ts`. |

`EXPO_PUBLIC_*` values are compiled into the app bundle and readable by anyone with
the app — never put secrets in them. Restart Metro after changing `.env`.

There is deliberately **no** default such as `http://localhost:…`. If the variable
is missing, the first API call throws an explicit `ApiConfigError`.

Reaching a backend on your own machine: iOS simulator → `http://localhost:<port>`;
Android emulator → `http://10.0.2.2:<port>`; physical device → your computer's LAN IP.

## Structure

```
frontend/
├── app.json                # Expo config (scheme "lunelle", ios/android)
├── tsconfig.json           # strict TS; "@/..." → src/...
├── eslint.frontend.config.mjs   # deliberately NOT named eslint.config.* (see Linting)
├── .env.example
└── src/
    ├── app/                # ROUTES ONLY — thin files that render a screen
    │   ├── _layout.tsx     #   providers + auth-gated navigator
    │   ├── index.tsx       #   "/" → redirect to /today or /welcome
    │   ├── (auth)/         #   signed-out group:  welcome
    │   └── (app)/          #   signed-in group (tabs): today, log, you
    ├── screens/            # Screen components (what the routes render)
    ├── components/         # Reusable UI (ui/Screen, Text, Card, Button)
    ├── api/                # HTTP client, typed errors, the configured `api`
    ├── auth/               # AuthProvider / useAuth, session type + persistence
    ├── storage/            # SecureStore wrapper (sensitive values only)
    ├── config/             # env.ts — the only place env vars are read
    ├── theme/              # design tokens + ThemeProvider / useTheme
    └── types/              # ambient type declarations
```

Rules of thumb:

- **Routes stay thin.** A file in `src/app/` only re-exports a screen. Logic lives
  in `screens/`, `components/`, `api/`, `auth/`.
- **Dependencies point one way:** `app → screens → components/auth/api → config/storage/theme`.
  `api/` does not import `auth/`; `auth/` hands its token to `api/` via `configureApiAuth`.
- **Use `@/…` imports** across folders (`@/theme`, `@/auth`, `@/api`).

## Navigation

Expo Router (file-based), source root `src/app/`.

```
/                 index.tsx            redirect → /today (signed in) | /welcome (signed out)
(auth)/welcome    WelcomeScreen        onboarding / sign-in placeholder
(app)/today       TodayScreen   ┐
(app)/log         LogScreen     ├─ bottom tabs
(app)/you         YouScreen     ┘
```

Auth gating is done once, in `src/app/_layout.tsx`, with `Stack.Protected`: the
`(app)` group is reachable only when signed in, and `(auth)` only when signed out.
When the auth state flips (sign-in, sign-out, or a 401), Expo Router moves the user
to the right group automatically — screens never navigate on auth changes themselves.

While the stored session is being read on launch (`status === 'loading'`) a spinner
is shown so the wrong group never flashes.

## API client

- `src/api/client.ts` — `createApiClient(config)`: **transport only**. Builds URLs,
  adds `Authorization: Bearer <token>`, applies a timeout (15 s default), parses JSON,
  and throws typed errors. It knows nothing about Lunelle's endpoints or React Native.
- `src/api/errors.ts` — `ApiError` (non-2xx; has `status` and `body`), `NetworkError`
  (offline / timeout; has `timedOut`), `ApiConfigError` (missing base URL).
- `src/api/index.ts` — exports the single configured `api` instance. The base URL
  comes from `config/env.ts`; the token and 401 handler are injected by the auth
  layer through `configureApiAuth()`.

```ts
import { api, ApiError } from '@/api'

const result = await api.get<SomeContractType>('/some/path', { query: { limit: 10 } })
await api.post<SomeContractType>('/some/path', { ...body })
await api.post('/sign-in', creds, { auth: false })   // public call: no token, no 401 handler
```

Notes: paths must start with `/`. `T` is the caller's assertion — the client does no
runtime validation. An authenticated 401 signs the user out.

## Auth

`src/auth/AuthProvider.tsx` is the single owner of auth state; the rest of the app
uses `useAuth()` → `{ status, session, isPreview, signIn, signOut, startPreviewSession }`.

- `status`: `'loading' | 'signedOut' | 'signedIn'`.
- On launch the provider restores the session from **SecureStore** (`src/auth/session.ts`
  → `src/storage/secureStorage.ts`, Keychain / Keystore).
- `signIn(session)` persists it; `signOut()` clears memory first, then storage.
- The API client reads the token from the provider and, on a 401, triggers `signOut()`.
- Tokens are sent as `Authorization: Bearer <JWT>`, the standard shape for a Supabase
  Auth–compatible backend.
- The dev-only preview session is in-memory, never persisted, and has no token.

**Not built:** the real sign-in flow and token refresh — see below.

## Theme

`src/theme/tokens.ts` carries V1's palettes verbatim: **Blossom** (light) and
**Moonlight** (dark), plus spacing, radius and type scales. `ThemeProvider` follows
the OS appearance; read tokens with `useTheme()`. V1's manual theme toggle is not
ported yet because it needs local persistence.

## Backend responsibility

The backend is authoritative for cycle calculations, forecasts, pattern confidence,
observations, account deletion and subscription state. **The frontend renders results
returned by the API and must not re-implement that logic.** V1's `src/lib/cycle.js`
math is intentionally not carried over.

## Contract status

At the time this foundation was written, `backend/`, `shared/`, `supabase/` and
`API_CONTRACT.md` were **not present** in this checkout or on the remote `main`, so
nothing here is typed against them. Consequently:

- No endpoint functions or request/response types exist. `api.get<T>()` is generic
  and unvalidated until the contract can be imported.
- `Session` (in `auth/session.ts`) and the error-message extraction in `api/errors.ts`
  are **provisional** placeholders, marked as such in the code.
- The auth mechanism (Supabase Auth directly from the app vs. backend-issued tokens),
  the token refresh flow, the error envelope, and whether `shared/` exports runtime
  schemas are all undecided.
- `app.json` has no `ios.bundleIdentifier` / `android.package` yet (needed for EAS builds).

Nothing in `shared/`, `backend/` or `supabase/` is modified from this app. If the
contract lacks something the frontend needs, document it and raise it with the backend
owner rather than working around it here.
