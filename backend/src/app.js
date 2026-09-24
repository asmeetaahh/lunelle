import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { ok, fail } from './lib/respond.js'
import { createErrorHandler } from './middleware/errorHandler.js'

/** Journal bodies are ≤ 5000 chars; nothing legitimate approaches this. */
export const JSON_BODY_LIMIT = '64kb'

/**
 * Rate-limit tiers. `standard` is deliberately generous — it is infrastructure,
 * not a throttle, until real traffic shapes it. `strict` is reserved for
 * AI/reflect and auth-sensitive operations (account deletion, etc.).
 */
export const RATE_LIMIT_DEFAULTS = Object.freeze({
  standard: Object.freeze({ windowMs: 15 * 60 * 1000, limit: 600 }),
  strict: Object.freeze({ windowMs: 15 * 60 * 1000, limit: 30 }),
})

/**
 * Build the limiters. Both answer with the failure envelope (429 rate_limited)
 * instead of express-rate-limit's plain-text default.
 *
 * @param {{ standard?: Partial<typeof RATE_LIMIT_DEFAULTS.standard>, strict?: Partial<typeof RATE_LIMIT_DEFAULTS.strict> }} [overrides]
 */
export function createRateLimiters(overrides = {}) {
  const make = (config) =>
    rateLimit({
      ...config,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Disable the proxy-header check: server.js sets `trust proxy` explicitly when deployed behind one.
      validate: { xForwardedForHeader: false, trustProxy: false },
      handler: (req, res) => fail(res, 429, 'rate_limited', 'Too many requests, please try again later'),
    })
  return {
    standard: make({ ...RATE_LIMIT_DEFAULTS.standard, ...overrides.standard }),
    strict: make({ ...RATE_LIMIT_DEFAULTS.strict, ...overrides.strict }),
  }
}

/**
 * CORS policy for a native-first API.
 *
 * - No `Origin` header (Expo native, curl, server-to-server): allowed. The
 *   browser same-origin model does not apply, so there is nothing to gate.
 * - `Origin` in the allow-list (Expo web / local dev tools): allowed, echoed back.
 * - Any other `Origin`: no CORS headers are emitted, so browsers block the
 *   response. The request itself is still authenticated by requireAuth.
 *
 * @param {string[]} allowedOrigins  exact origins, e.g. ['http://localhost:8081']
 */
export function corsOptions(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins.map((o) => o.trim()).filter(Boolean))
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      return callback(null, allowed.has(origin))
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  }
}

/**
 * Express application factory. Does not listen; server.js does that.
 *
 * Order matters:
 *   helmet → CORS → JSON body → GET /api/health (unlimited)
 *   → standard limiter on /api → routes(app) → 404 → error handler
 *
 * @param {Object} [options]
 * @param {string[]} [options.corsOrigins=[]]        allow-listed web origins (server.js passes these from config)
 * @param {Parameters<typeof createRateLimiters>[0]} [options.rateLimit]  limiter overrides (tests)
 * @param {(app: import('express').Express, ctx: { limiters: ReturnType<typeof createRateLimiters> }) => void} [options.routes]
 *        hook to mount routers after core middleware and before the 404/error handlers
 * @param {{ error: (...args: unknown[]) => void }} [options.logger=console]
 */
export function createApp({ corsOrigins = [], rateLimit: rateLimitOverrides, routes, logger = console } = {}) {
  const app = express()
  const limiters = createRateLimiters(rateLimitOverrides)

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors(corsOptions(corsOrigins)))
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  // Liveness. Public, never rate-limited, shape is non-contractual (API_CONTRACT.md §6.1).
  app.get('/api/health', (req, res) =>
    ok(res, {
      status: 'ok',
      message: 'Lunelle backend is running',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    }),
  )

  app.use('/api', limiters.standard)
  app.locals.limiters = limiters

  if (routes) routes(app, { limiters })

  app.use((req, res) => fail(res, 404, 'not_found', 'Route not found'))
  app.use(createErrorHandler({ logger }))

  return app
}
