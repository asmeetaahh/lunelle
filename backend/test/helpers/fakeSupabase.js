/**
 * Recording stand-in for a supabase-js client.
 *
 * Every `from(table)` starts a new call; every builder method appends
 * `[method, ...args]` to that call's chain and returns the builder. The builder
 * is thenable like the real one and resolves with the next queued response
 * (`{ data, error }`) — it never rejects, exactly like supabase-js.
 */
const METHODS = ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in', 'order', 'limit', 'range', 'maybeSingle', 'single']

export function createFakeSupabase(responses = []) {
  const calls = []
  const queue = [...responses]
  const client = {
    /** RPC calls are recorded as `{ rpc: name, args }` and consume a queued response too. */
    rpc(name, args) {
      calls.push({ rpc: name, args })
      const response = queue.length ? queue.shift() : { data: null, error: null }
      return { then: (resolve, reject) => Promise.resolve(response).then(resolve, reject) }
    },
    from(table) {
      const call = { table, chain: [] }
      calls.push(call)
      const response = queue.length ? queue.shift() : { data: null, error: null }
      const builder = {}
      for (const method of METHODS) {
        builder[method] = (...args) => {
          call.chain.push([method, ...args])
          return builder
        }
      }
      builder.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject)
      return builder
    },
  }
  return { client, calls }
}

/** The chain of the only call made, as `[method, ...args]` tuples. */
export function onlyCall(calls) {
  if (calls.length !== 1) throw new Error(`expected exactly one query, got ${calls.length}`)
  return calls[0]
}

/** Names of the methods used in a chain, in order. */
export const methodsOf = (call) => call.chain.map(([method]) => method)

/** Args of the first use of `method` in a chain. */
export const argsOf = (call, method) => call.chain.find(([m]) => m === method)?.slice(1)
