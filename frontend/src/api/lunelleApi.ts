// The thing a screen imports (`shared/api.ts`: "LunelleApi is the only thing
// a screen imports"). Only `auth` and `today` are implemented in this slice;
// `onboarding` / `log` / `you` / `premium` are deliberately absent rather than
// stubbed — the type below proves what's here matches the real contract
// exactly, without inventing placeholder behaviour for what isn't built yet.
//
// `auth.deleteAccount` is also absent — see `./auth.ts`.
import type { LunelleApi } from '@shared/api'

import { auth } from './auth'
import { today } from './today'

export const lunelleApi: Pick<LunelleApi, 'today'> & {
  auth: Omit<LunelleApi['auth'], 'deleteAccount'>
} = {
  auth,
  today,
}
