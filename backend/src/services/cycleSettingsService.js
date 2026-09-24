/**
 * Cycle settings orchestration (API_CONTRACT.md §6.3).
 *
 * Writes the settings row, then — when `lastPeriodStart` was supplied as a
 * date — makes sure a matching `period_start` cycle event exists. The two
 * repositories stay independent; this is the only place they are combined.
 *
 * Idempotent: resubmitting the same onboarding form never creates a second
 * event. A duplicate raised by a concurrent insert is absorbed here because it
 * is not a conflict from the user's point of view; genuine POST /api/cycle-events
 * duplicates still surface as 409 through their own route.
 *
 * Clearing `lastPeriodStart` (null) clears the setting only. Events are the
 * user's history and are never deleted by this service.
 */
import * as cycleSettingsRepo from '../repositories/cycleSettings.js'
import * as cycleEventsRepo from '../repositories/cycleEvents.js'

const UNIQUE_VIOLATION = '23505'

/**
 * @param {{ cycleSettings?: typeof cycleSettingsRepo, cycleEvents?: typeof cycleEventsRepo }} [repos]
 */
export function createCycleSettingsService({ cycleSettings = cycleSettingsRepo, cycleEvents = cycleEventsRepo } = {}) {
  return {
    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} db  caller-scoped client
     * @returns {Promise<import('../../../shared/types').CycleSettings | null>}
     */
    get(db) {
      return cycleSettings.get(db)
    },

    /**
     * @param {import('@supabase/supabase-js').SupabaseClient} db  caller-scoped client
     * @param {import('../../../shared/types').CycleSettingsInput} input  already validated
     * @returns {Promise<{ settings: import('../../../shared/types').CycleSettings, periodStartEvent: import('../../../shared/types').CycleEvent | null, eventCreated: boolean }>}
     */
    async upsert(db, input) {
      const settings = await cycleSettings.upsert(db, input)

      if (typeof input.lastPeriodStart !== 'string') {
        return { settings, periodStartEvent: null, eventCreated: false }
      }

      const date = input.lastPeriodStart
      const [existing] = await cycleEvents.list(db, { from: date, to: date, type: 'period_start' })
      if (existing) return { settings, periodStartEvent: existing, eventCreated: false }

      try {
        const event = await cycleEvents.insert(db, { type: 'period_start', date })
        return { settings, periodStartEvent: event, eventCreated: true }
      } catch (error) {
        if (error?.code !== UNIQUE_VIOLATION) throw error
        // Raced with another writer for the same day: the event exists now, which is all we need.
        const [raced] = await cycleEvents.list(db, { from: date, to: date, type: 'period_start' })
        return { settings, periodStartEvent: raced ?? null, eventCreated: false }
      }
    },
  }
}

export const cycleSettingsService = createCycleSettingsService()
