// GET /api/today — implements `LunelleApi['today']`.
//
// `date` is always the device-local calendar date (shared/api.ts rule 5). It
// is sent two ways for the one reason (backend/src/lib/clientDate.js):
//   - as the `date` query param — what the response is computed for;
//   - as `X-Client-Date` — what the backend treats as "today" when checking
//     that `date` isn't in the future. Without it the backend falls back to
//     its own UTC calendar day, which is wrong for a device far enough east
//     that its local date is already a day ahead of the server's.
// The cycle/pattern engines never see a clock; this is the API layer's job.
import { API_ROUTES } from '@shared/api'
import type { ISODate, TodaySnapshot } from '@shared/types'

import { api } from './index'

export const today = {
  get(date: ISODate): Promise<TodaySnapshot> {
    return api.get<TodaySnapshot>(API_ROUTES.today, {
      query: { date },
      headers: { 'X-Client-Date': date },
    })
  },
}
