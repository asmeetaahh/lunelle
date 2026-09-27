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

**`shared/` isn't in this checkout yet.** It lives on the `backend-v2-integration`
branch and needs to reach `main` (or this branch) before `npm install` + `npm run
check` reproduce what's described below on a fresh clone. Until then, copy `shared/`
to the repo root (sibling of `frontend/`) yourself — see [`/shared` wiring](#shared-wiring).

## Status: Today slice implemented, everything else is a placeholder

**Real:** Supabase Auth (sign up / sign in / sign out / session restore, via
`@supabase/supabase-js`, wired to SecureStore), the API client (bearer auth,
refresh-and-retry-once, envelope unwrapping, typed errors), and `GET /api/today`
end to end — `TodayScreen` calls it and renders the real `TodaySnapshot`.

**Still placeholders:** Log and You tabs, onboarding UI, the Welcome screen's actual
sign-in *form* (the underlying `auth.signIn`/`signUp` are real; there's no UI to
collect credentials yet), Journal, AI, RevenueCat, notifications. See
[`/shared` wiring](#shared-wiring) for what's typed against the real contract vs.
what's deliberately not built yet.

## Running it

Requires Node 20+ and either the iOS Simulator, an Android emulator, or the Expo
Go app on a device.

```bash
# once: copy /shared from backend-v2-integration to the repo root, see below
cd frontend
npm install
cp .env.example .env      # set EXPO_PUBLIC_API_URL and the Supabase vars (see below)
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
| `EXPO_PUBLIC_SUPABASE_URL` | for auth | Supabase project URL (API_CONTRACT.md §9) — same project the Express API uses. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | for auth | Anon/publishable key. Safe to expose — RLS protects data, not secrecy of this key. |

`EXPO_PUBLIC_*` values are compiled into the app bundle and readable by anyone with
the app — never put a secret (`SUPABASE_SERVICE_ROLE_KEY` and similar) in one.
Restart Metro after changing `.env`.

There is deliberately **no** default such as `http://localhost:…`. If a variable is
missing, the first call that needs it throws an explicit `ApiConfigError`.

Reaching a backend on your own machine: iOS simulator → `http://localhost:<port>`;
Android emulator → `http://10.0.2.2:<port>`; physical device → your computer's LAN IP.

## Structure

```
frontend/
├── app.json                # Expo config (scheme "lunelle", ios/android)
├── metro.config.js         # watchFolders → ../shared, so it resolves and bundles
├── tsconfig.json           # strict TS; "@/..." → src/..., "@shared/..." → ../shared/...
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
    ├── api/                # LunelleApi implementation — see API client, below
    │   ├── client.ts       #   transport: URLs, bearer auth, refresh-retry-once, envelope
    │   ├── errors.ts       #   NetworkError, ApiConfigError (ApiError itself is @shared/api's)
    │   ├── index.ts        #   the configured `api`, configureApiAuth()
    │   ├── auth.ts         #   LunelleApi['auth'] (minus deleteAccount)
    │   ├── today.ts        #   LunelleApi['today']
    │   └── lunelleApi.ts   #   composes the above — what a screen imports
    ├── auth/               # React state over api/auth.ts
    │   ├── supabaseClient.ts  # the ONLY file importing @supabase/supabase-js
    │   └── AuthProvider.tsx   # useAuth(): status, session, signUp/signIn/signOut
    ├── storage/            # SecureStore wrapper (sensitive values only)
    ├── lib/                # date.ts — device-local ISODate; no cycle math lives here
    ├── config/             # env.ts — the only place env vars are read
    ├── theme/              # design tokens + ThemeProvider / useTheme
    └── types/              # ambient type declarations
```

Rules of thumb:

- **Routes stay thin.** A file in `src/app/` only re-exports a screen. Logic lives
  in `screens/`, `components/`, `api/`, `auth/`.
- **Dependencies point one way:** `app → screens → auth/api → config/storage/theme`.
  `api/` does not import `auth/`; `auth/` hands the API client a token getter and a
  refresher via `configureApiAuth`. Only `auth/supabaseClient.ts` imports
  `@supabase/supabase-js` — nothing else in the app does, screens included.
- **Use `@/…` imports** across folders (`@/theme`, `@/auth`, `@/api`), and `@shared/…`
  for the contract (`@shared/types`, `@shared/api`) — never a relative `../../../shared/…`.

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
  attaches `Authorization: Bearer <token>`, unwraps `{ success: true, data }`,
  throws `ApiError` from `@shared/api` for `{ success: false, code, message }`, and
  implements the contract's refresh-and-retry-once rule (see below). It knows nothing
  about individual endpoints — those are `api/auth.ts` / `api/today.ts`.
- `src/api/errors.ts` — `NetworkError` (offline / timeout) and `ApiConfigError`
  (missing env var). **Not** `ApiError` — that's `@shared/api`'s; re-defining it here
  would make a `catch` block's `instanceof` check depend on which module's copy an
  error came from, exactly what `/shared` exists to prevent.
- `src/api/index.ts` — exports the configured `api` instance and `configureApiAuth()`.
- `src/api/lunelleApi.ts` — `{ auth, today }`, typed against the real `LunelleApi`
  interface (`Pick`/`Omit`, not duplicated). This is what a screen imports.

```ts
import { lunelleApi } from '@/api/lunelleApi'
import { isApiError } from '@/api'

const snapshot = await lunelleApi.today.get('2026-09-24') // TodaySnapshot, from @shared/types
try {
  await lunelleApi.auth.signIn({ email, password })
} catch (e) {
  if (isApiError(e)) { /* branch on e.code, never e.message — shared/api.ts rule 4 */ }
}
```

**Refresh-and-retry-once** (shared/api.ts rule 2, `client.ts`'s `request()`): on a 401
whose body's `code` is specifically `invalid_token`, the client calls
`refreshAccessToken()` once and retries the same request once. If the retry is also
401, or the refresh itself fails, `onUnauthorized()` fires (→ real sign-out) and the
`ApiError` is thrown. `missing_authorization` / `malformed_authorization` 401s are
**not** retried — refreshing a token can't fix a request that never attached one
correctly, and retrying would just repeat the same bug. Behaviour is covered by a
scripted fake-`fetch` test (11 cases: envelope unwrap, all three 401 codes, 204,
malformed 2xx body, network failure, `auth: false`) run outside the repo, not
committed — there's no test runner set up for this app yet.

## Auth

`src/auth/AuthProvider.tsx` is the single owner of auth state; the rest of the app
uses `useAuth()` → `{ status, session, isPreview, signUp, signIn, signOut,
startPreviewSession }`. It's a thin React wrapper over `api/auth.ts`
(`LunelleApi['auth']`, minus `deleteAccount` — out of scope for this slice).

- `status`: `'loading' | 'signedOut' | 'signedIn'`.
- `session` is `AuthSession | null` from `@shared/types` — `{ userId, email }` only.
  **The access token never leaves `auth/supabaseClient.ts`.**
- Session persistence, restore and refresh are owned by `@supabase/supabase-js`
  itself: `auth/supabaseClient.ts` gives it `storage/secureStorage.ts` as its storage
  adapter (`persistSession: true`), so sign-in/out/refresh all read and write
  SecureStore without this app hand-rolling any of it.
- `signUp(email, password)` / `signIn(email, password)` call Supabase Auth directly;
  `AuthProvider`'s `supabase.auth.onAuthStateChange` subscription (not the call sites)
  is the one place session state is written, so sign-in, sign-out and a background
  token refresh all update `useAuth()` state the same way.
- `signOut()` calls real `supabase.auth.signOut()`; if that itself fails (e.g.
  offline), local state is cleared anyway rather than stranding the user "signed in"
  with no way to retry the network call.
- The API client's `refreshAccessToken`/`getAccessToken` (wired in via
  `configureApiAuth`) also come from `supabaseClient.ts` — not part of `LunelleApi`
  itself, since the token is never meant to reach outside the auth/API implementation.
- The dev-only preview session is in-memory, never persisted, and has no token —
  real API calls made while previewing 401 with `missing_authorization`, as expected.

**Not built:** the sign-in/sign-up *form* UI, and `auth.deleteAccount()`.

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

## `/shared` wiring

The real contract exists (`backend-v2-integration` branch: `backend/`, `shared/`,
`supabase/`, `API_CONTRACT.md`) and this app is typed against it directly —
`@shared/types` and `@shared/api` (`import type { TodaySnapshot } from '@shared/types'`,
etc.), never a local duplicate. Three things had to agree for that alias to work,
and all three are checked (`npm run check` + a real `expo export`, not just `tsc`):

1. **TypeScript** — `tsconfig.json`: `"@shared/*": ["../shared/*"]`.
2. **Metro** (the bundler `tsc` never runs) — `metro.config.js`: `watchFolders:
   [repoRoot]`, the standard Expo monorepo pattern. Without this, types resolve but
   `expo start`/`export` cannot actually find the files at bundle time.
3. **ESLint** — `eslint.frontend.config.mjs`: `import/resolver: { typescript: {...} }`
   so `eslint-plugin-import` reads the same tsconfig paths. `import/no-unresolved` /
   `namespace` / `export` are off — `tsc` already checks every import resolves and
   every named import exists, more reliably; this plugin's resolver additionally
   walks parent directories with `readdirSync` for a case-sensitivity check, which
   can crash outright on a path outside this package depending on filesystem
   permissions. Not a loss of coverage, since `tsc` already covers what it checked.

**`shared/` is not in this git checkout.** It has to be copied to the repo root
(sibling of `frontend/`, not inside it) from wherever the backend integration lives
before any of the above works — `cp -r <path-to-backend-v2-integration>/shared
../shared` from `frontend/`, or check out that branch/worktree. Until the two
branches are merged, keeping `shared/` out of `frontend-v2`'s own history is
deliberate: `API_CONTRACT.md`'s change process (§12) starts with "Edit `/shared`",
and that never happens from this app.

Implemented against the real contract: `LunelleApi['auth']` (minus `deleteAccount`)
and `LunelleApi['today']`. Not yet: `onboarding`, `log`, `you`, `premium` — absent
from `api/lunelleApi.ts` entirely rather than stubbed, so its type is an honest
subset of `LunelleApi`, not a promise the rest works.

Known gaps, not yet addressed:
- `app.json` has no `ios.bundleIdentifier` / `android.package` yet (needed for EAS builds).
- SecureStore's per-value size limit (documented around 2048 bytes on some platforms)
  hasn't been checked against a real Supabase session's serialized size (access +
  refresh token + user object). If it's ever exceeded, the fix is a chunked storage
  adapter — not attempted speculatively without evidence it's needed.

Nothing in `shared/`, `backend/` or `supabase/` is modified from this app. If the
contract lacks something the frontend needs, document it and raise it with the backend
owner rather than working around it here.
