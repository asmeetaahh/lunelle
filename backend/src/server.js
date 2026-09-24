/**
 * Lunelle V2 backend — process bootstrap.
 *
 * This file only wires things together: validated config → Express app →
 * listener → shutdown. All behaviour lives in app.js, routes/, services/,
 * repositories/ and engines/. Nothing here reads process.env directly, opens
 * a socket at import time, or logs a secret.
 *
 *   node src/server.js        starts the server (see `isMain` below)
 *   import { createServer }   builds the app without listening (tests)
 */
import { pathToFileURL } from 'node:url'
import { getConfig, EnvValidationError } from './config/env.js'
import { createApp } from './app.js'
import { registerRoutes } from './routes/index.js'

/**
 * The documented deployments (nginx in docker-compose, Azure App Service) put
 * exactly one reverse proxy in front of the process, so trust that single hop
 * for req.ip / rate-limit keys. Set `trustProxy: false` when the process is
 * exposed directly; never `true`, which would let clients forge X-Forwarded-For.
 */
export const DEFAULT_TRUST_PROXY = 1

/** How long a graceful shutdown waits for in-flight requests before forcing exit. */
export const SHUTDOWN_TIMEOUT_MS = 10_000

/**
 * Build the production application. Does not listen.
 *
 * @param {Object} [options]
 * @param {import('./config/env.js').Config} [options.config]   validated config; defaults to getConfig()
 * @param {string[]} [options.corsOrigins=[]]  web origins to allow-list (native clients need none)
 * @param {number|boolean} [options.trustProxy=DEFAULT_TRUST_PROXY]
 * @param {import('express').RequestHandler} [options.requireAuth]  override for tests only
 * @param {{ info?: Function, error: Function }} [options.logger=console]
 */
export function createServer({ config = getConfig(), corsOrigins = [], trustProxy = DEFAULT_TRUST_PROXY, requireAuth, logger = console } = {}) {
  const app = createApp({
    corsOrigins,
    logger,
    routes: (a, ctx) => registerRoutes(a, requireAuth ? { ...ctx, requireAuth } : ctx),
  })
  app.set('trust proxy', trustProxy)
  return { app, config }
}

/**
 * Build a shutdown function: stop accepting connections, wait for in-flight
 * requests (bounded), then exit. Idempotent.
 *
 * @param {{ server: import('node:http').Server, logger?: { info?: Function, error: Function }, exit?: (code: number) => void, timeoutMs?: number }} deps
 */
export function createShutdown({ server, logger = console, exit = (code) => process.exit(code), timeoutMs = SHUTDOWN_TIMEOUT_MS }) {
  let started = false
  return function shutdown(signal = 'shutdown') {
    if (started) return
    started = true
    logger.info?.(`${signal} received, closing server`)
    const timer = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit')
      exit(1)
    }, timeoutMs)
    timer.unref?.()
    server.close(() => {
      clearTimeout(timer)
      exit(0)
    })
  }
}

/**
 * Start listening. The only place app.listen() is called.
 *
 * @param {Parameters<typeof createServer>[0] & { proc?: NodeJS.EventEmitter & { exit: Function }, exit?: (code: number) => void }} [options]
 * @returns {{ app: import('express').Express, server: import('node:http').Server, shutdown: (signal?: string) => void, config: object }}
 */
export function startServer({ proc = process, exit = (code) => proc.exit(code), ...options } = {}) {
  const { app, config } = createServer(options)
  const logger = options.logger ?? console

  const server = app.listen(config.PORT, () => {
    logger.info?.(`Lunelle backend listening on port ${server.address().port}`)
  })
  server.on('error', (error) => {
    // error.code is safe (EADDRINUSE, EACCES…); never print config values.
    logger.error(`Failed to start Lunelle backend: ${error.code ?? error.message}`)
    exit(1)
  })

  // `once`: the first signal drains gracefully; a second one falls through to Node's default handler (force quit).
  const shutdown = createShutdown({ server, logger, exit })
  proc.once('SIGTERM', () => shutdown('SIGTERM'))
  proc.once('SIGINT', () => shutdown('SIGINT'))

  return { app, server, shutdown, config }
}

/** Entry point for `node src/server.js`. Config problems name variables, never values. */
export function main({ logger = console, exit = (code) => process.exit(code), start = startServer } = {}) {
  try {
    return start({ logger })
  } catch (error) {
    if (error instanceof EnvValidationError) {
      logger.error(error.message)
    } else {
      logger.error(`Failed to start Lunelle backend: ${error?.message ?? error}`)
    }
    exit(1)
    return null
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) main()
