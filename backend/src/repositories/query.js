/**
 * Await a supabase-js query and unwrap it. supabase-js never rejects; it
 * resolves `{ data, error }`. Repositories throw the raw PostgREST error
 * object unchanged so middleware/errorHandler.js can map its `code`.
 *
 * @template T
 * @param {PromiseLike<{ data: T, error: unknown }>} query
 * @returns {Promise<T>}
 */
export async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

/** Guard for partial upserts/updates: an empty payload would be a no-op that still returns 200. */
export function requireFields(payload, what) {
  if (Object.keys(payload).length === 0) throw new TypeError(`${what}: at least one field is required`)
  return payload
}
