/**
 * Mount every authenticated V2 router. Passed to createApp as its `routes`
 * hook (server.js will do this at cutover; tests do it now).
 *
 * Paths are the API_ROUTES of shared/api.ts, pinned by test/routes.test.js.
 * Journal routes arrive in a later step.
 */
import { requireAuth as defaultRequireAuth } from '../middleware/requireAuth.js'
import { createCycleSettingsRouter } from './cycleSettings.js'
import { createCycleEventsRouter } from './cycleEvents.js'
import { createObservationsRouter } from './observations.js'
import { createSubscriptionRouter } from './subscription.js'
import { createAccountRouter } from './account.js'
import { createTodayRouter } from './today.js'
import { createYouRouter } from './you.js'

export const MOUNT_PATHS = Object.freeze({
  cycleSettings: '/api/cycle-settings',
  cycleEvents: '/api/cycle-events',
  observations: '/api/observations',
  today: '/api/today',
  you: '/api/you',
  subscription: '/api/subscription',
  account: '/api/account',
})

/**
 * @param {import('express').Express} app
 * @param {{ limiters: { standard: import('express').RequestHandler, strict: import('express').RequestHandler }, requireAuth?: import('express').RequestHandler }} ctx
 */
export function registerRoutes(app, { limiters, requireAuth = defaultRequireAuth }) {
  app.use(MOUNT_PATHS.cycleSettings, createCycleSettingsRouter({ requireAuth }))
  app.use(MOUNT_PATHS.cycleEvents, createCycleEventsRouter({ requireAuth }))
  app.use(MOUNT_PATHS.observations, createObservationsRouter({ requireAuth }))
  app.use(MOUNT_PATHS.today, createTodayRouter({ requireAuth }))
  app.use(MOUNT_PATHS.you, createYouRouter({ requireAuth }))
  app.use(MOUNT_PATHS.subscription, createSubscriptionRouter({ requireAuth }))
  app.use(MOUNT_PATHS.account, createAccountRouter({ requireAuth, limiter: limiters.strict }))
}
