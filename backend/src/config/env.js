import 'dotenv/config'
import { inspect } from 'node:util'
import { z } from 'zod'

// Every variable the V2 backend needs. Add here first; nothing else reads process.env.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_ANON_KEY: z.string().trim().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  REVENUECAT_WEBHOOK_SECRET: z.string().trim().min(1),
  AI_API_KEY: z.string().trim().min(1),
})

/** @typedef {z.infer<typeof envSchema>} Config */

export class EnvValidationError extends Error {
  /** @param {string[]} problems  one "NAME: reason" line per failing variable — never the value */
  constructor(problems) {
    super(`Invalid backend environment:\n  - ${problems.join('\n  - ')}`)
    this.name = 'EnvValidationError'
    this.problems = problems
  }
}

/**
 * Validate an environment source and return a frozen config object.
 * Only variable names and zod messages appear in errors; values are never included.
 *
 * @param {Record<string, string | undefined>} [source=process.env]
 * @returns {Readonly<Config>}
 * @throws {EnvValidationError}
 */
export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(root)'
      const reason = issue.code === 'invalid_type' && issue.input === undefined ? 'missing' : issue.message
      return `${name}: ${reason}`
    })
    throw new EnvValidationError(problems)
  }

  const config = { ...result.data }
  // Redact when someone logs the whole object; individual fields are still readable in code.
  Object.defineProperty(config, inspect.custom, { value: () => '[Config: values redacted]' })
  Object.defineProperty(config, 'toJSON', { value: () => '[Config: values redacted]' })
  return Object.freeze(config)
}

let cached = null

/**
 * Process-wide config, validated once on first use.
 * Call early at boot so a bad environment fails before any request is served.
 *
 * @returns {Readonly<Config>}
 */
export function getConfig() {
  if (!cached) cached = loadEnv()
  return cached
}
